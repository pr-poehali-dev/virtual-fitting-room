import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getPageSeo } from "@/config/seo";

const setMeta = (selector: string, value: string) => {
  const tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (tag) tag.setAttribute("content", value);
};

/**
 * Подставляет заголовок и описание страницы при переходах.
 * Ничего не рисует — только обновляет теги в шапке документа.
 */
const PageSeo = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description, noindex } = getPageSeo(pathname);
    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);

    // Служебные страницы прячем от поисковиков, обычные — открываем обратно
    let robots = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", noindex ? "noindex, follow" : "index, follow");
  }, [pathname]);

  return null;
};

export default PageSeo;