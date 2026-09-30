import { type ThemeName, THEMES } from '../types';

interface ThemePageProps {
  current: ThemeName;
  onSelect: (theme: ThemeName) => void;
  onBack: () => void;
}

export default function ThemePage({ current, onSelect, onBack }: ThemePageProps) {
  return (
    <div className="min-h-screen bg-th-page">
      {/* Header */}
      <header className="bg-th-header shadow-sm sticky top-0 z-10 border-b border-th">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-th-muted hover:text-th-heading transition-colors p-1 rounded-lg"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-th-heading">Themes</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-th-muted mb-6">Choose a look for your session.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(THEMES) as ThemeName[]).map((key) => {
            const theme = THEMES[key];
            const isActive = key === current;

            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className={`text-left rounded-2xl p-5 border-2 bg-th-card transition-all ${
                  isActive
                    ? 'border-th-primary shadow-lg'
                    : 'border-th hover:border-th-primary hover:shadow-md'
                }`}
              >
                {/* Swatches */}
                <div className="flex gap-2 mb-4">
                  {theme.swatches.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full shadow-sm border border-white/30"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-th-heading">{theme.name}</div>
                    <div className="text-xs text-th-muted mt-0.5">{theme.description}</div>
                  </div>
                  {isActive && (
                    <span className="text-xs font-bold text-white bg-th-primary px-2.5 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
