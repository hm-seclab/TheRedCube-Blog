import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/TheRedCube-Blog/",

  lang: "en-US",
  title: "TheRedCube",
  description: "A website and blog for the CTF team of the University of Applied Sciences Munich",

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});
