---
date: 2022-11-18
author: Marius Biebel
timeline: false
---

# Its right there

## Description

I couldn't come up with an interesting android challenge, so I kinda just stuck the flag in a textbox. It's right there, just take it.

## Our Approach

With the challenge, we received an **.apk** file that contained an app. Upon launching the app, the description was not deceptive. The flag was conspicuously displayed in enormous letters. So large, in fact, that they were too big to read. And as it turns out, we were unable to scroll.

The fun thing is, afterwards if we look into the write-up published by SquareCTF themselves, the idea was to reverse the app that encrypts the flag and we were supposed to decrypt it, following the Kotlin code.

We did nothing of this. The problem was that we were not able to scroll. So we simply used the **accessibility services of Android** so the assistant for visually impaired **read the flag out loud**. That worked great. Never got a flag that easily. It was great fun for us.