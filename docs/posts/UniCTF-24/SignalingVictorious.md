---
date: 2024-12-18
author: Herbert Bärschneider
article: false
timeline: false
---

# Signaling Victorious (Forensics, hard) - WriteUp

The challenge "Signaling Victorious" offers following elements:
+ a file `win10_memdump.elf`
    + memory dump of a Windows 10 system
+ a file `backup.7z`
    + encrypted archive, encompassing the user directories from a Windows system
+ access to a web panel and web socket
    + spawned on demand
    + the web panel and web socket belong to the post-exploitation and adversary emulation framework "Empire" ([the "Starkiller" Frontend for "Empire"](https://github.com/bc-security/starkiller))

Solving this challenge was a lot of frustration and learning for me. The following write up will not only show the needed steps for solving, but also tell about the wrong paths I took.

A first look at the encrypted archive `backup.7z` (e. g. using `7z l backup.7z`) shows that it covers three user profiles: `C:\Users\Default`, `C:\Users\Public` and `C:\Users\frontier-user-01`. Immediately interesting are files related to the application "Signal Desktop".
The encryption algorithm for the archive is "LZMA2:26 BCJ 7zAES" and typical passwords (123456, password, infected, etc.) do not work.

My first guess was to find further information and likely a password, in the memory file. Due to prior experience, I already knew a reliable tool for memory analysis: [volatility3](https://github.com/volatilityfoundation/volatility3). A first quick check with volatility3 showed that the tool works with the file in its given format (I used the command `vol -f win10_memdump.elf windows.info`).

For an initial overview, I collected the information from following commands:
+ `vol -f win10_memdump.elf windows.psscan`
    + this command outputs information on running processes as well as recently run processes - it is usually meant to find processes that are "hidden" from userland, but I prefer it due to the additional context that can be gained from recently run processes
    + I immediately notices processes for PowerShell and Signal - the first is interesting, as PowerShell is often used by malicious actors for their actions (and the theme of this CTF is catching some bad guys) and the second is interesting, as we already have data from Signal in the encrypted archive (which felt like too much coincidence for a CTF)
+ `vol -f win10_memdump.elf windows.cmdline`
    + this command outputs information on the commandlines used for running processes
    + I noticed a process using the program `C:\Users\frontier-user-01\Desktop\backuper.exe` as suspicious - processes are normally run with programs stored under `C:\Windows` or `C:\Program Files`; furthermore, attacker tools are also often staged in user folders like "Desktop", "Downloads" and "Documents"
+ `vol -f win10_memdump.elf windows.filescan`
    + this command outputs information on all files that are (partially) present in the memory image
    + I didn't check the output immediately, but prepared it for later, as it is needed for when I would find files of interest that I may want to try to extract from the memory image (which is often possible for recently used files due to in memory caching)

I started with pulling the process memory for two PowerShell processes (PID 4124 and PID 7056), hoping to find PowerShell scripts in it. But due to the size of the process memories and amount of output for standard strings searches, I could not effectively find anything. So I decided to shift towards the suspicious process using `C:\Users\frontier-user-01\Desktop\backuper.exe`, dumping the program for more investigation (using `vol -f win10_memdump.elf windows.pslist --pid 7392 --dump` - PID 7392 belongs to the process running based on the program of interest).
A simple search with `strings 7392.backuper.exe.0x7ff764a70000.dmp` and `strings -e l 7392.backuper.exe.0x7ff764a70000.dmp` brought the first lead in form of the embedded string: "7z.exe a -t7z backup.7z "C:\Users\" -p%ws". I felt assured that this program was used to create the encrypted archive and that further analysis will help me identify the password.

For reverse engineering, there are many tools available. I like to start with [radare2](https://github.com/radareorg/radare2) to have a quick peak at the "main" function of the program (using `r2 -A 7392.backuper.exe.0x7ff764a70000.dmp`, followed by the radare command `s main; pdf` and get a feeling on how complicated it will get and which heavier tools I will need. 
The "main" function does show references to the earlier found string, but due to the extensive usage of function calls, I pivoted to [Ghidra](https://github.com/NationalSecurityAgency/ghidra) for further digging (note: post mortem, all relevant information could already be found during this quick peak, but past me was not so "enlightened" yet :D).

After importing the program in the Ghidra CodeBrowser, the "main" function is named "FUN_7ff764ab4d20". The following snippet highlights the important parts of that function:
./img/SignalingVictorious_GhidraDecompiled.png
At this point, I understood that the password was retrieved from LSA, using the key name "OfflineBackupKey". Due to prior experience with how Windows stores secrets, I decided to try retrieve this key from the registry hives of the system (note: post mortem, I realized that I could have pulled the information from the "LSASS" process present in the memory image using `vol -f win10_memdump.elf windows.lsadump` and inspecting the results with a hex editor, as it contains bytes that mess with the terminal and actually hide the entries of interest :D).
I dumped all registry hives out of the memory image (using `vol -f win10_memdump.elf windows.registry.hivelist --dump`) and parsed the stored secrets using [impacket](https://github.com/fortra/impacket) (using `impacket-secretsdump -security registry.SECURITY.0xdd8e00ce8000.hive  -system registry.SYSTEM.0xdd8dfd663000.hive LOCAL`). This gave me the value "yYj8g5Pk6h!-K3pBMSxF" for the "OfflineBackupKey". This password worked for decrypting the archive `backup.7z`, opening the way for more data to investigate.

After some exploration of the contents in `backup.7z`, I started to focus on data form the Signal Desktop program (found at `Users/frontier-user-01/AppData/Roaming/Signal`). I identified three files of interest:
+ `Users/frontier-user-01/AppData/Roaming/Signal/sql/db.sqlite`
    + a SQLite database (as by file ending), but not recognized as any file format - this made me suspect that encryption is at work
+ `Users/frontier-user-01/AppData/Roaming/Signal/config.json`
    + stores a key - naming implies that this key is also encrypted
+ `Users/frontier-user-01/AppData/Roaming/Signal/Local\ State`
    + stores another key - base64 decoding reveals a reference to "DPAPI"
At this point, I focused on trying to decrypt the Signal database, hoping to find more relevant information in the messages stored in their. Some research about Signal database decryption found lots of posts from a few years ago, pointing to the SQLite database being encrypted with a key stored in `config.json`. These posts showed that the key was directly usable. But I also stumbled over [more recent reporting](https://www.blackhatethicalhacking.com/news/signal-enhances-desktop-client-security-after-six-year-delay-on-encryption-key-issue/) claiming that the security of the database encryption key was improved. I found no clear public information on how to decrypt the database after the latest changes. 
But my search lead me to a blog post about a [similar problem, decrypting Chrome stored passwords secured via DPAPI](https://blog.haicen.me/posts/extracting-chrome-passwords-pypykatz/). I noticed the same naming and structure in `Users/frontier-user-01/AppData/Roaming/Signal/Local\ State` ans suspected that Signal Desktop might be using a similar approach to securing the encryption key of the Signal database.

I set out to decrypt the information in `Users/frontier-user-01/AppData/Roaming/Signal/Local\ State`. Checking the encryption key using `pypykatz dpapi describe blob <hex of base64 decoded encrypted key with the first five bytes removed>`, I got the GUID for the relevant "masterkey": "ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917". The archive `backup.7z` contains a file with the same name at `Users/frontier-user-01/AppData/Roaming/Microsoft/Protect/S-1-5-21-1208348762-991206961-812773293-1001/ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917`. 
At this time, I started following the earlier mentioned blog post for decryption, focusing on decrypting the masterkey file. I created the prekey values (using the command `pypykatz dpapi prekey registry registry.SYSTEM.0xdd8dfd663000.hive registry.SAM.0xdd8e00d64000.hive registry.SECURITY.0xdd8e00ce8000.hive -o dpapi_prekey`) and attempted the decryption of the masterkey file (using the command `pypykatz dpapi masterkey ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917 dpapi_prekey -o dpapi_masterkey`). This failed and I got stuck for a while on this.
After much frustrated research about DPAPI, I stumbled over a [volatility3 plugin for pypykatz](https://github.com/skelsec/pypykatz-volatility3) and used it for dumping data (using the command `vol -f win10_memdump.elf -p vol3plugins/ pypykatz`). This finally gave me the DPAPI masterkey for "b71b6fc-d0b8-4d7b-aa12-6ece19ff1917" with the value "791ca70e650987684b043745c6f4b1c0f97eb2369317302c6c60f9cda19e1b4864fbece48341141501606d8d359ff7f54ee71e4a2b821d3df69582927742809f". This also made the prior steps of extracting the masterkey file and creating decryption key candidates obsolete :').

With the DPAPI masterkey in my hands, I immediately got stuck at trying to use it to decrypt `Users/frontier-user-01/AppData/Roaming/Signal/Local\ State`. I did not find an option to give `pypykatz` the masterkey directly (it kept insisting that the output of its own commands for decrypting the masterkey file should be used for any further steps) and a [second tool I tried](https://github.com/fortra/impacket/blob/master/impacket/dpapi.py) did not work for me.
I ultimately dived into the source code of `pypykatz` and manually created the input structure it wished for (created as the file `masterkey.json` with the following content):
```
{ 
    "masterkeys" : 
       {"ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917": "791ca70e650987684b043745c6f4b1c0f97eb2369317302c6c60f9cda19e1b4864fbece48341141501606d8d359ff7f54ee71e4a2b821d3df69582927742809f"},
    "backupkeys": []
}
```
Afterwards, I managed to decrypt the data from `Users/frontier-user-01/AppData/Roaming/Signal/Local\ State` - more precisely the base64 decoded, hex encoded encryption key with the first five bytes removed (using the command `pypykatz dpapi blob masterkey.json 01000000d08c9ddf0115d1118c7a00c04fc297eb01000000fcb671abb8d07b4daa126ece19ff191710000000120000004300680072006f006d00690075006d0000001066000000010000200000008a6a43ef0960de45d79fdf48a4fb445f1d3517850adf01d7dc10ebb37eff2c0d000000000e80000000020000200000001a77d04749516e6262340fc406f7ddb8c4be29cdec14d4b7a61a6693953cdc3a3000000020d123465bf34fe1e81a284bf44e097d244dddd2d150a71e86ea531ca0e945dc4c91fddaf485b6c16d092c4c490409cc400000001dabab44b91b878c93703fbf8711baed57dad332c4209a503805b0e81203530fa344763702e214d30772c72e65bfa09911898842a51bc89497ccf20fa6a627eb`).
This gave me the key "7582f084a7d00872eebe919c2c02da0a8f4d8e67e648bb55805e8994a8a165ef". which itself is used to encrypt the value in `Users/frontier-user-01/AppData/Roaming/Signal/config.json`.

For decrypting `Users/frontier-user-01/AppData/Roaming/Signal/config.json`, I used a [description found on stackoverflow](https://stackoverflow.com/questions/60416350/chrome-80-how-to-decode-cookies/60423699#60423699) ([using CyberChef](https://gchq.github.io/CyberChef/) for the decryption). This gave me the key "65f77c5912a1456af299975228bb45857144ee8fb546683c9274e11a1617fa65".

Finally, I could tackle the last layer of decryption: the encryption of `Users/frontier-user-01/AppData/Roaming/Signal/sql/db.sqlite` itself. With the right key in hand, I grabbed myself `sqlcipher` and followed the [steps for decrypting and testing the access](https://www.zetetic.net/sqlcipher/sqlcipher-api/#testing-the-key) (running inside of `sqlcipher` the command `PRAGMA key = "x'65f77c5912a1456af299975228bb45857144ee8fb546683c9274e11a1617fa65'";`). As a recurring theme for me, this did not work. After cross-checking with the source code of Signal Desktop, I was sure to be using the right commands.
I switched to a Windows system and the most recent version of [DB Browser for SQLite](https://sqlitebrowser.org/), a handy tool I knew from prior investigations of SQLite databases. For reasons unknown to me and not further investigation by me, DB Browser managed to decrypt the database with the given key. This enabled me to investigate the content of the Signal Desktop program, especially any messages that were written and received.

Investigating the Signal Database was straight forward: the table "messages" contained a small number of written and received messages. They contained credentials for the deployed "Empire" framework: `empireadmin:eNSrj4qHp0pG#075D98@`.
I used these credentials to access the Starkiller web panel. As I was unfamiliar with the tool, I stumbled around for a while through all the menus. 
The flag was found on the subpage "Credentials": `HTB{s1gn4l_m0v3_t0_dp4p1_w0nt_st0p_us!!!}`

Personal thoughts:
This was a fun challenge, especially the memory analysis part. But the challenge was too far outside my normal skill set, as evident with the amount of time I took researching and the amount of problems with the tooling. I felt very happy when I found the flag, as I was already fearing that I needed to dive into "Empire" next :D.
_I feel the need to comment that even though this challenge showed how to decrypt the Signal Desktop database, it did require files and access that are not normally available to an unprivileged user account (besides the user whose Signal Desktop instance it is)._
