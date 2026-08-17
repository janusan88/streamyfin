/** @type {import('tailwindcss').Config} */

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 马卡龙主配色体系
        macaron: {
          bg: "#FFFDF9",        // 柔和乳白背景（告别冷冰冰的深色/纯白）
          card: "#FFFFFF",      // 纯白卡片背景
          pink: "#FFB7B2",      // 柔粉色（主按钮/强调色）
          yellow: "#FFDAC1",    // 奶油黄（提示/辅助色）
          green: "#B5EAD7",     // 薄荷绿（高亮/选中色）
          blue: "#C7CEEA",      // 天空蓝（次要按钮/背景补色）
          purple: "#E2F0CB",    // 浅果绿/紫罗兰点缀
          text: "#4A4A4A",      // 深灰文字（比纯黑更柔和，保护儿童视力）
          muted: "#9B9B9B",     // 次要灰字
        },
        // 覆盖 Tailwind 默认的主色与背景色，实现全局一键换肤
        background: "#FFFDF9",
        primary: "#FFB7B2",
      },
      borderRadius: {
        // 增加圆润膨胀感的大圆角
        'macaron': '20px',
        'macaron-lg': '28px',
      }
    },
  },
  plugins: [],
};
