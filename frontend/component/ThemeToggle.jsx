export default function ThemeToggle() {
  const toggle = () => {
    const html = document.documentElement;
    html.classList.toggle("dark");

    const theme = html.classList.contains("dark") ? "dark" : "light";
    localStorage.setItem("theme", theme);
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
    >
      🌙
    </button>
  );
}