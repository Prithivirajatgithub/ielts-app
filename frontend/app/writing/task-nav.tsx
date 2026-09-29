import Link from "next/link";

const TASKS = [
  { href: "/writing/task1", label: "Task 1", description: "Graphs & Charts" },
  { href: "/writing", label: "Task 2", description: "Essay" },
  { href: "/listening", label: "Listening", description: "Section 1" },
  { href: "/speaking", label: "Speaking", description: "Cue Card" },
] as const;

export default function TaskNav({
  active,
}: {
  active: "task1" | "task2" | "listening" | "speaking";
}) {
  return (
    <nav className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {TASKS.map((task) => {
        const isActive =
          (active === "task1" && task.href === "/writing/task1") ||
          (active === "task2" && task.href === "/writing") ||
          (active === "listening" && task.href === "/listening") ||
          (active === "speaking" && task.href === "/speaking");
        return (
          <Link
            key={task.href}
            href={task.href}
            className={`flex flex-1 flex-col items-center rounded-xl px-4 py-2.5 text-center transition ${
              isActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span className="text-sm font-semibold">{task.label}</span>
            <span
              className={`text-xs ${
                isActive ? "text-indigo-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {task.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
