interface BrandProps {
  /** onDark — для тёмной подложки. Геометрия у вариантов одна, различаются только цвета. */
  variant?: 'onLight' | 'onDark';
  onClick?: () => void;
  className?: string;
}

// Иконка + название. Внешних отступов внутри компонента нет: где логотип
// стоит, решает то место, куда его вставили, — иначе одна и та же вёрстка
// давала бы разное положение на разных страницах.
//
// Название скрыто на узких экранах: так было задумано в шапке приложения,
// где рядом с логотипом стоят колокольчик и выход. Правило общее для всех
// страниц, чтобы логотип на мобильной ширине выглядел одинаково везде.
export default function Brand({ variant = 'onLight', onClick, className = '' }: BrandProps) {
  const onDark = variant === 'onDark';
  return (
    <div
      data-brand=""
      className={`flex items-center gap-2 shrink-0 ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        onDark ? 'bg-white/20' : 'bg-gradient-to-br from-[#0A2E5C] to-[#00B2FF]'
      }`}>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <span className={`font-bold text-lg hidden sm:block ${onDark ? 'text-white' : 'text-[#0A2E5C]'}`}>
        MetrologyCatalog
      </span>
    </div>
  );
}
