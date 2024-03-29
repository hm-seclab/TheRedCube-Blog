# TheRedCube Blog

This is the blog of the CTF team **TheRedCube** from the University of Applied Sciences, Munich. This repository is intended to be a place for write-ups and blog posts related to the CTF team.

## Technology

The page is built as a GitHub Pages project. It gets built and published every time something is merged/pushed on the main branch. It's based on [VuePress](https://vuejs.press/) and the theme [VuePress Theme Hope](https://theme-hope.vuejs.press/).

## Add a Write-up

For each CTF, a new directory is added to the `/docs/posts/[CTF]` directory. The CTF can be described by adding a *README.md* in the directory. Also, write-ups can be added by adding further markdown files in the directory.

As a best practice, the README.md should link to the associated write-ups. CTFs should be posted in the timeline as an article. The CTFs from the README should be listed. Therefore, configure the write-ups with `article` and `timeline` set to `false`. 

```md
---
date: 2022-11-18
author: Marius Biebel
timeline: false
article: false
---

# Writeup

here goes the Markdown text

```