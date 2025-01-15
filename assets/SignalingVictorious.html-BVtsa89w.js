import{_ as t}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as o,b as i,o as a}from"./app-Co0ACPsU.js";const r="/TheRedCube-Blog/assets/SignalingVictorious_GhidraDecompiled-ClbHcoCF.png",n={};function s(d,e){return a(),o("div",null,e[0]||(e[0]=[i('<h1 id="signaling-victorious-forensics-hard-writeup" tabindex="-1"><a class="header-anchor" href="#signaling-victorious-forensics-hard-writeup"><span>Signaling Victorious (Forensics, hard) - WriteUp</span></a></h1><p>The challenge &quot;Signaling Victorious&quot; offers following elements:</p><ul><li>a file <code>win10_memdump.elf</code><ul><li>memory dump of a Windows 10 system</li></ul></li><li>a file <code>backup.7z</code><ul><li>encrypted archive, encompassing the user directories from a Windows system</li></ul></li><li>access to a web panel and web socket <ul><li>spawned on demand</li><li>the web panel and web socket belong to the post-exploitation and adversary emulation framework &quot;Empire&quot; (<a href="https://github.com/bc-security/starkiller" target="_blank" rel="noopener noreferrer">the &quot;Starkiller&quot; Frontend for &quot;Empire&quot;</a>)</li></ul></li></ul><p>Solving this challenge was a lot of frustration and learning for me. The following write up will not only show the needed steps for solving, but also tell about the wrong paths I took.</p><p>A first look at the encrypted archive <code>backup.7z</code> (e. g. using <code>7z l backup.7z</code>) shows that it covers three user profiles: <code>C:\\Users\\Default</code>, <code>C:\\Users\\Public</code> and <code>C:\\Users\\frontier-user-01</code>. Immediately interesting are files related to the application &quot;Signal Desktop&quot;. The encryption algorithm for the archive is &quot;LZMA2:26 BCJ 7zAES&quot; and typical passwords (123456, password, infected, etc.) do not work.</p><p>My first guess was to find further information and likely a password, in the memory file. Due to prior experience, I already knew a reliable tool for memory analysis: <a href="https://github.com/volatilityfoundation/volatility3" target="_blank" rel="noopener noreferrer">volatility3</a>. A first quick check with volatility3 showed that the tool works with the file in its given format (I used the command <code>vol -f win10_memdump.elf windows.info</code>).</p><p>For an initial overview, I collected the information from following commands:</p><ul><li><code>vol -f win10_memdump.elf windows.psscan</code><ul><li>this command outputs information on running processes as well as recently run processes - it is usually meant to find processes that are &quot;hidden&quot; from userland, but I prefer it due to the additional context that can be gained from recently run processes</li><li>I immediately notices processes for PowerShell and Signal - the first is interesting, as PowerShell is often used by malicious actors for their actions (and the theme of this CTF is catching some bad guys) and the second is interesting, as we already have data from Signal in the encrypted archive (which felt like too much coincidence for a CTF)</li></ul></li><li><code>vol -f win10_memdump.elf windows.cmdline</code><ul><li>this command outputs information on the commandlines used for running processes</li><li>I noticed a process using the program <code>C:\\Users\\frontier-user-01\\Desktop\\backuper.exe</code> as suspicious - processes are normally run with programs stored under <code>C:\\Windows</code> or <code>C:\\Program Files</code>; furthermore, attacker tools are also often staged in user folders like &quot;Desktop&quot;, &quot;Downloads&quot; and &quot;Documents&quot;</li></ul></li><li><code>vol -f win10_memdump.elf windows.filescan</code><ul><li>this command outputs information on all files that are (partially) present in the memory image</li><li>I didn&#39;t check the output immediately, but prepared it for later, as it is needed for when I would find files of interest that I may want to try to extract from the memory image (which is often possible for recently used files due to in memory caching)</li></ul></li></ul><p>I started with pulling the process memory for two PowerShell processes (PID 4124 and PID 7056), hoping to find PowerShell scripts in it. But due to the size of the process memories and amount of output for standard strings searches, I could not effectively find anything. So I decided to shift towards the suspicious process using <code>C:\\Users\\frontier-user-01\\Desktop\\backuper.exe</code>, dumping the program for more investigation (using <code>vol -f win10_memdump.elf windows.pslist --pid 7392 --dump</code> - PID 7392 belongs to the process running based on the program of interest). A simple search with <code>strings 7392.backuper.exe.0x7ff764a70000.dmp</code> and <code>strings -e l 7392.backuper.exe.0x7ff764a70000.dmp</code> brought the first lead in form of the embedded string: &quot;7z.exe a -t7z backup.7z &quot;C:\\Users&quot; -p%ws&quot;. I felt assured that this program was used to create the encrypted archive and that further analysis will help me identify the password.</p><p>For reverse engineering, there are many tools available. I like to start with <a href="https://github.com/radareorg/radare2" target="_blank" rel="noopener noreferrer">radare2</a> to have a quick peak at the &quot;main&quot; function of the program (using <code>r2 -A 7392.backuper.exe.0x7ff764a70000.dmp</code>, followed by the radare command <code>s main; pdf</code> and get a feeling on how complicated it will get and which heavier tools I will need. The &quot;main&quot; function does show references to the earlier found string, but due to the extensive usage of function calls, I pivoted to <a href="https://github.com/NationalSecurityAgency/ghidra" target="_blank" rel="noopener noreferrer">Ghidra</a> for further digging (note: post mortem, all relevant information could already be found during this quick peak, but past me was not so &quot;enlightened&quot; yet 😄).</p><p>After importing the program in the Ghidra CodeBrowser, the &quot;main&quot; function is named &quot;FUN_7ff764ab4d20&quot;. The following snippet highlights the important parts of that function: <img src="'+r+`" alt="Snippet of decompiled Code from Ghidra" loading="lazy"> At this point, I understood that the password was retrieved from LSA, using the key name &quot;OfflineBackupKey&quot;. Due to prior experience with how Windows stores secrets, I decided to try retrieve this key from the registry hives of the system (note: post mortem, I realized that I could have pulled the information from the &quot;LSASS&quot; process present in the memory image using <code>vol -f win10_memdump.elf windows.lsadump</code> and inspecting the results with a hex editor, as it contains bytes that mess with the terminal and actually hide the entries of interest 😄). I dumped all registry hives out of the memory image (using <code>vol -f win10_memdump.elf windows.registry.hivelist --dump</code>) and parsed the stored secrets using <a href="https://github.com/fortra/impacket" target="_blank" rel="noopener noreferrer">impacket</a> (using <code>impacket-secretsdump -security registry.SECURITY.0xdd8e00ce8000.hive -system registry.SYSTEM.0xdd8dfd663000.hive LOCAL</code>). This gave me the value &quot;yYj8g5Pk6h!-K3pBMSxF&quot; for the &quot;OfflineBackupKey&quot;. This password worked for decrypting the archive <code>backup.7z</code>, opening the way for more data to investigate.</p><p>After some exploration of the contents in <code>backup.7z</code>, I started to focus on data form the Signal Desktop program (found at <code>Users/frontier-user-01/AppData/Roaming/Signal</code>). I identified three files of interest:</p><ul><li><code>Users/frontier-user-01/AppData/Roaming/Signal/sql/db.sqlite</code><ul><li>a SQLite database (as by file ending), but not recognized as any file format - this made me suspect that encryption is at work</li></ul></li><li><code>Users/frontier-user-01/AppData/Roaming/Signal/config.json</code><ul><li>stores a key - naming implies that this key is also encrypted</li></ul></li><li><code>Users/frontier-user-01/AppData/Roaming/Signal/Local\\ State</code><ul><li>stores another key - base64 decoding reveals a reference to &quot;DPAPI&quot; At this point, I focused on trying to decrypt the Signal database, hoping to find more relevant information in the messages stored in their. Some research about Signal database decryption found lots of posts from a few years ago, pointing to the SQLite database being encrypted with a key stored in <code>config.json</code>. These posts showed that the key was directly usable. But I also stumbled over <a href="https://www.blackhatethicalhacking.com/news/signal-enhances-desktop-client-security-after-six-year-delay-on-encryption-key-issue/" target="_blank" rel="noopener noreferrer">more recent reporting</a> claiming that the security of the database encryption key was improved. I found no clear public information on how to decrypt the database after the latest changes. But my search lead me to a blog post about a <a href="https://blog.haicen.me/posts/extracting-chrome-passwords-pypykatz/" target="_blank" rel="noopener noreferrer">similar problem, decrypting Chrome stored passwords secured via DPAPI</a>. I noticed the same naming and structure in <code>Users/frontier-user-01/AppData/Roaming/Signal/Local\\ State</code> ans suspected that Signal Desktop might be using a similar approach to securing the encryption key of the Signal database.</li></ul></li></ul><p>I set out to decrypt the information in <code>Users/frontier-user-01/AppData/Roaming/Signal/Local\\ State</code>. Checking the encryption key using <code>pypykatz dpapi describe blob &lt;hex of base64 decoded encrypted key with the first five bytes removed&gt;</code>, I got the GUID for the relevant &quot;masterkey&quot;: &quot;ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917&quot;. The archive <code>backup.7z</code> contains a file with the same name at <code>Users/frontier-user-01/AppData/Roaming/Microsoft/Protect/S-1-5-21-1208348762-991206961-812773293-1001/ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917</code>. At this time, I started following the earlier mentioned blog post for decryption, focusing on decrypting the masterkey file. I created the prekey values (using the command <code>pypykatz dpapi prekey registry registry.SYSTEM.0xdd8dfd663000.hive registry.SAM.0xdd8e00d64000.hive registry.SECURITY.0xdd8e00ce8000.hive -o dpapi_prekey</code>) and attempted the decryption of the masterkey file (using the command <code>pypykatz dpapi masterkey ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917 dpapi_prekey -o dpapi_masterkey</code>). This failed and I got stuck for a while on this. After much frustrated research about DPAPI, I stumbled over a <a href="https://github.com/skelsec/pypykatz-volatility3" target="_blank" rel="noopener noreferrer">volatility3 plugin for pypykatz</a> and used it for dumping data (using the command <code>vol -f win10_memdump.elf -p vol3plugins/ pypykatz</code>). This finally gave me the DPAPI masterkey for &quot;b71b6fc-d0b8-4d7b-aa12-6ece19ff1917&quot; with the value &quot;791ca70e650987684b043745c6f4b1c0f97eb2369317302c6c60f9cda19e1b4864fbece48341141501606d8d359ff7f54ee71e4a2b821d3df69582927742809f&quot;. This also made the prior steps of extracting the masterkey file and creating decryption key candidates obsolete 😂.</p><p>With the DPAPI masterkey in my hands, I immediately got stuck at trying to use it to decrypt <code>Users/frontier-user-01/AppData/Roaming/Signal/Local\\ State</code>. I did not find an option to give <code>pypykatz</code> the masterkey directly (it kept insisting that the output of its own commands for decrypting the masterkey file should be used for any further steps) and a <a href="https://github.com/fortra/impacket/blob/master/impacket/dpapi.py" target="_blank" rel="noopener noreferrer">second tool I tried</a> did not work for me. I ultimately dived into the source code of <code>pypykatz</code> and manually created the input structure it wished for (created as the file <code>masterkey.json</code> with the following content):</p><div class="language- line-numbers-mode" data-highlighter="shiki" data-ext="" data-title="" style="--shiki-light:#383A42;--shiki-dark:#abb2bf;--shiki-light-bg:#FAFAFA;--shiki-dark-bg:#282c34;"><pre class="shiki shiki-themes one-light one-dark-pro vp-code"><code><span class="line"><span>{ </span></span>
<span class="line"><span>    &quot;masterkeys&quot; : </span></span>
<span class="line"><span>       {&quot;ab71b6fc-d0b8-4d7b-aa12-6ece19ff1917&quot;: &quot;791ca70e650987684b043745c6f4b1c0f97eb2369317302c6c60f9cda19e1b4864fbece48341141501606d8d359ff7f54ee71e4a2b821d3df69582927742809f&quot;},</span></span>
<span class="line"><span>    &quot;backupkeys&quot;: []</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Afterwards, I managed to decrypt the data from <code>Users/frontier-user-01/AppData/Roaming/Signal/Local\\ State</code> - more precisely the base64 decoded, hex encoded encryption key with the first five bytes removed (using the command <code>pypykatz dpapi blob masterkey.json 01000000d08c9ddf0115d1118c7a00c04fc297eb01000000fcb671abb8d07b4daa126ece19ff191710000000120000004300680072006f006d00690075006d0000001066000000010000200000008a6a43ef0960de45d79fdf48a4fb445f1d3517850adf01d7dc10ebb37eff2c0d000000000e80000000020000200000001a77d04749516e6262340fc406f7ddb8c4be29cdec14d4b7a61a6693953cdc3a3000000020d123465bf34fe1e81a284bf44e097d244dddd2d150a71e86ea531ca0e945dc4c91fddaf485b6c16d092c4c490409cc400000001dabab44b91b878c93703fbf8711baed57dad332c4209a503805b0e81203530fa344763702e214d30772c72e65bfa09911898842a51bc89497ccf20fa6a627eb</code>). This gave me the key &quot;7582f084a7d00872eebe919c2c02da0a8f4d8e67e648bb55805e8994a8a165ef&quot;. which itself is used to encrypt the value in <code>Users/frontier-user-01/AppData/Roaming/Signal/config.json</code>.</p><p>For decrypting <code>Users/frontier-user-01/AppData/Roaming/Signal/config.json</code>, I used a <a href="https://stackoverflow.com/questions/60416350/chrome-80-how-to-decode-cookies/60423699#60423699" target="_blank" rel="noopener noreferrer">description found on stackoverflow</a> (<a href="https://gchq.github.io/CyberChef/" target="_blank" rel="noopener noreferrer">using CyberChef</a> for the decryption). This gave me the key &quot;65f77c5912a1456af299975228bb45857144ee8fb546683c9274e11a1617fa65&quot;.</p><p>Finally, I could tackle the last layer of decryption: the encryption of <code>Users/frontier-user-01/AppData/Roaming/Signal/sql/db.sqlite</code> itself. With the right key in hand, I grabbed myself <code>sqlcipher</code> and followed the <a href="https://www.zetetic.net/sqlcipher/sqlcipher-api/#testing-the-key" target="_blank" rel="noopener noreferrer">steps for decrypting and testing the access</a> (running inside of <code>sqlcipher</code> the command <code>PRAGMA key = &quot;x&#39;65f77c5912a1456af299975228bb45857144ee8fb546683c9274e11a1617fa65&#39;&quot;;</code>). As a recurring theme for me, this did not work. After cross-checking with the source code of Signal Desktop, I was sure to be using the right commands. I switched to a Windows system and the most recent version of <a href="https://sqlitebrowser.org/" target="_blank" rel="noopener noreferrer">DB Browser for SQLite</a>, a handy tool I knew from prior investigations of SQLite databases. For reasons unknown to me and not further investigation by me, DB Browser managed to decrypt the database with the given key. This enabled me to investigate the content of the Signal Desktop program, especially any messages that were written and received.</p><p>Investigating the Signal Database was straight forward: the table &quot;messages&quot; contained a small number of written and received messages. They contained credentials for the deployed &quot;Empire&quot; framework: <code>empireadmin:eNSrj4qHp0pG#075D98@</code>. I used these credentials to access the Starkiller web panel. As I was unfamiliar with the tool, I stumbled around for a while through all the menus. The flag was found on the subpage &quot;Credentials&quot;: <code>HTB{s1gn4l_m0v3_t0_dp4p1_w0nt_st0p_us!!!}</code></p><p>Personal thoughts: This was a fun challenge, especially the memory analysis part. But the challenge was too far outside my normal skill set, as evident with the amount of time I took researching and the amount of problems with the tooling. I felt very happy when I found the flag, as I was already fearing that I needed to dive into &quot;Empire&quot; next 😄. <em>I feel the need to comment that even though this challenge showed how to decrypt the Signal Desktop database, it did require files and access that are not normally available to an unprivileged user account (besides the user whose Signal Desktop instance it is).</em></p>`,21)]))}const p=t(n,[["render",s],["__file","SignalingVictorious.html.vue"]]),h=JSON.parse('{"path":"/posts/UniCTF-24/SignalingVictorious.html","title":"Signaling Victorious (Forensics, hard) - WriteUp","lang":"en-US","frontmatter":{"date":"2024-12-18T00:00:00.000Z","author":"Herbert Bärschneider","article":false,"timeline":false,"description":"Signaling Victorious (Forensics, hard) - WriteUp The challenge \\"Signaling Victorious\\" offers following elements: a file win10_memdump.elf memory dump of a Windows 10 system a fi...","head":[["meta",{"property":"og:url","content":"https://hm-seclab.github.io/TheRedCube-Blog/posts/UniCTF-24/SignalingVictorious.html"}],["meta",{"property":"og:site_name","content":"TheRedCube"}],["meta",{"property":"og:title","content":"Signaling Victorious (Forensics, hard) - WriteUp"}],["meta",{"property":"og:description","content":"Signaling Victorious (Forensics, hard) - WriteUp The challenge \\"Signaling Victorious\\" offers following elements: a file win10_memdump.elf memory dump of a Windows 10 system a fi..."}],["meta",{"property":"og:type","content":"website"}],["meta",{"property":"og:locale","content":"en-US"}],["meta",{"property":"og:updated_time","content":"2025-01-15T12:31:10.000Z"}],["meta",{"property":"article:author","content":"Herbert Bärschneider"}],["meta",{"property":"article:published_time","content":"2024-12-18T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2025-01-15T12:31:10.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"WebPage\\",\\"name\\":\\"Signaling Victorious (Forensics, hard) - WriteUp\\",\\"description\\":\\"Signaling Victorious (Forensics, hard) - WriteUp The challenge \\\\\\"Signaling Victorious\\\\\\" offers following elements: a file win10_memdump.elf memory dump of a Windows 10 system a fi...\\"}"]]},"headers":[],"git":{"createdTime":1734642721000,"updatedTime":1736944270000,"contributors":[{"name":"Herbert","username":"Herbert","email":"34774005+Herbert-Karl@users.noreply.github.com","commits":1,"url":"https://github.com/Herbert"},{"name":"mbiebel","username":"mbiebel","email":"mariuxdeangelo@outlook.com","commits":2,"url":"https://github.com/mbiebel"}]},"readingTime":{"minutes":6.39,"words":1918},"filePathRelative":"posts/UniCTF-24/SignalingVictorious.md","localizedDate":"December 18, 2024","excerpt":"\\n<p>The challenge \\"Signaling Victorious\\" offers following elements:</p>\\n<ul>\\n<li>a file <code>win10_memdump.elf</code>\\n<ul>\\n<li>memory dump of a Windows 10 system</li>\\n</ul>\\n</li>\\n<li>a file <code>backup.7z</code>\\n<ul>\\n<li>encrypted archive, encompassing the user directories from a Windows system</li>\\n</ul>\\n</li>\\n<li>access to a web panel and web socket\\n<ul>\\n<li>spawned on demand</li>\\n<li>the web panel and web socket belong to the post-exploitation and adversary emulation framework \\"Empire\\" (<a href=\\"https://github.com/bc-security/starkiller\\" target=\\"_blank\\" rel=\\"noopener noreferrer\\">the \\"Starkiller\\" Frontend for \\"Empire\\"</a>)</li>\\n</ul>\\n</li>\\n</ul>","autoDesc":true}');export{p as comp,h as data};
