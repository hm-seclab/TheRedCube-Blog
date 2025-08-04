---
date: 2022-11-18
author: Marius Biebel
article: false
---

# It's right there

## Description

I couldn't think of an interesting Android challenge, so I just stuck the flag in a textbox. It's right there; just take it.

## Our Approach

With the challenge, we received an app containing a **.apk** file. Upon launching the app, the description was not deceptive. The flag was conspicuously displayed in enormous letters. They were so large, in fact, that they were too big to read. And as it turns out, we were unable to scroll.

The fun thing is, afterwards, if we look into the write-up published by SquareCTF themselves, the idea is to reverse the app that encrypts the flag, and we are supposed to decrypt it, following the Kotlin code.

We did nothing of this. The problem was that we were not able to scroll. So we used the **accessibility services of Android** so the assistant for  visually impaired **read the flag out loud**. That worked great. We never got a flag that easily. It was great fun for us.
