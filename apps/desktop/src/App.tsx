export default function App() {
  return (
    <div className="h-full flex items-center justify-center bg-white/30 dark:bg-black/30">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">kata Workbench</h1>
        <p className="text-sm opacity-70">Apple HIG token verification</p>
        <button className="px-4 py-2 rounded bg-accent-light dark:bg-accent-dark text-white transition-all duration-base ease-apple-out hover:opacity-90 active:scale-[0.97]">
          Test button
        </button>
      </div>
    </div>
  );
}
