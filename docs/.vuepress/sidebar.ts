import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    {
      text: "Home",
      icon: "home",
      prefix: "/",
      link: "/",
    },
    {
      text: "About us",
      icon: "question",
      link: "/about.html",
    },
    {
      text: "WriteUps",
      icon: "book",
      prefix: "posts/",
      children: "structure",
    },
  ],
});
