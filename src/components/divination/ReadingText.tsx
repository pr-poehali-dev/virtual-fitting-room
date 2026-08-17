import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReadingTextProps {
  text: string;
  className?: string;
  /** Без своей подложки — для картинки-результата, где фон уже светлый */
  bare?: boolean;
  /** Плотнее и мельче — для коротких ответов в диалоге */
  compact?: boolean;
}

/**
 * Текст толкования с настоящими заголовками.
 * Нейросеть присылает разметку значками (# ## **жирный**) — без разбора
 * они видны в тексте как мусор. Здесь превращаем их в оформление.
 */
const ReadingText = ({
  text,
  className = "",
  bare = false,
  compact = false,
}: ReadingTextProps) => (
  <div
    className={
      bare
        ? `text-[17px] leading-[1.75] text-[#2f2618] ${className}`
        : compact
          ? `rounded-xl p-3 text-[15px] leading-[1.7] text-[#2f2618] shadow-inner sm:p-5 sm:text-[16px] ${className}`
          : `rounded-2xl p-4 text-[17px] leading-[1.75] text-[#2f2618] shadow-inner sm:p-7 sm:text-[18px] ${className}`
    }
    style={
      bare
        ? undefined
        : { background: "linear-gradient(180deg, #f7f0e1 0%, #f2e9d6 100%)" }
    }
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h2 className="mb-4 mt-8 border-b-2 border-[#c9a84c]/40 pb-2 font-serif text-2xl font-semibold text-[#4a2f13] first:mt-0 sm:text-[26px]">
            {children}
          </h2>
        ),
        h2: ({ children }) => (
          <h3 className="mb-3 mt-7 font-serif text-xl font-semibold text-[#5a3a18] first:mt-0 sm:text-[22px]">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h4 className="mb-2 mt-6 text-lg font-semibold text-[#6b4520] first:mt-0">
            {children}
          </h4>
        ),
        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-[#4a2f13]">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => (
          <ul className="mb-4 list-disc space-y-1.5 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 list-decimal space-y-1.5 pl-5">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-4 border-[#c9a84c]/50 bg-[#c9a84c]/10 py-2 pl-4 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-6 border-[#c9a84c]/30" />,
        a: ({ children }) => <span>{children}</span>,
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-[#c9a84c]/30 bg-[#c9a84c]/10 p-2 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[#c9a84c]/25 p-2 align-top">
            {children}
          </td>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);

export default ReadingText;