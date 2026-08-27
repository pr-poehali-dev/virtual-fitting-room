import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getPageSeo } from "@/config/seo";

/** Основной адрес сайта — от него строятся канонические ссылки */
const SITE_URL = "https://fitting-room.ru";

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

    // Канонический адрес: без меток из рекламы и без слэша в конце,
    // чтобы поисковики не считали такие ссылки разными страницами
    const path = pathname !== "/" ? pathname.replace(/\/+$/, "") : "";
    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${SITE_URL}${path}`);
    setMeta('meta[property="og:url"]', `${SITE_URL}${path}`);
  }, [pathname]);

  return null;
};

export default PageSeo;