import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import HeaderBalance from "@/components/HeaderBalance";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const userInitial = user?.name?.charAt(0).toUpperCase() || "U";

  const [knowledgePosts, setKnowledgePosts] = useState<
    { id: number; title: string; slug: string; cover_url: string | null; excerpt: string | null; section: string }[]
  >([]);

  useEffect(() => {
    const DB_QUERY = "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";
    fetch(DB_QUERY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "knowledge_posts",
        action: "select",
        columns: ["id", "title", "slug", "cover_url", "excerpt", "section"],
        order_by: "created_at DESC",
        limit: 3,
      }),
    })
      .then((r) => r.json())
      .then((data) => setKnowledgePosts(Array.isArray(data) ? data : data.data || []))
      .catch(() => setKnowledgePosts([]));
  }, []);

  const knowledgeSectionLabels: Record<string, string> = {
    instruction: "Инструкция",
    news: "Новость",
    article: "Статья",
    prompts: "Промпт",
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const services = [
    {
      id: "kibbe-test",
      title: "Определение типажа по Кибби",
      description:
        "Бесплатный тест: ответьте на вопросы о фигуре и узнайте свой типаж из 10 по системе Дэвида Кибби",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/093af219-f0e0-48f3-a4ad-c0702c19d22a.jpg",
      icon: "Ruler",
      path: "/kibbe-test",
      free: true,
    },
    {
      id: "archetype-test",
      title: "Определение архетипа по Юнгу",
      description:
        "Бесплатный тест: ответьте на 36 вопросов и узнайте свой ведущий архетип из 12 по системе Карла Юнга",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/d16fa4cd-bace-430f-81dc-1652d9dc85ce.png",
      icon: "Brain",
      path: "/archetype-test",
      free: true,
    },
    {
      id: "color-type",
      title: "Определение цветотипа",
      description:
        "Узнайте свой цветотип и получите персональные рекомендации по палитре цветов в одежде",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/vVKssj2jWDNvzCNyONYmW.png",
      icon: "Palette",
      path: "/colortype",
    },
    {
      id: "style-analysis",
      title: "Стилевой анализ внешности",
      description:
        "Персональная инфографика по фото: подходящие стили, палитра цветов, образы и рекомендации стилиста. Можно скачать",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/9fffb324-d895-47f2-9494-abbddc2158db.jpg",
      icon: "Wand2",
      path: "/style-analysis",
    },
    {
      id: "outfit-selection",
      title: "Подбор образов",
      description:
        "Персональный образ по вашему фото и параметрам: одежда, обувь, аксессуары и украшения — собранный лук под ваш повод. Можно скачать",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/8f739bdd-174d-41c0-bec9-6a01a5c58fd8.png",
      icon: "Gem",
      path: "/outfit-selection",
    },
    {
      id: "virtual-fitting",
      title: "Виртуальная примерочная",
      description:
        "Примерьте одежду онлайн с помощью ИИ — загрузите своё фото и посмотрите, как на вас сидит выбранная вещь",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/AFOzmM93nFTwxvTxlbpUm.png",
      icon: "Shirt",
      path: "/virtualfitting",
    },
    {
      id: "consult-stylist",
      title: "Консультация ИИ-стилиста",
      description:
        "Задайте вопрос своими словами и приложите фото: нейросеть разберёт задачу, даст конкретные рекомендации и по желанию составит промпт (задание на генерацию картинки), чтобы тут же нарисовать её",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/70aa9d7f-d67f-4621-81e4-cfb68ac222ff.jpg",
      icon: "MessageCircleQuestion",
      path: "/consult-stylist",
    },
    {
      id: "free-generation",
      title: "Генерация изображений",
      description:
        "Создавайте уникальные изображения по текстовому описанию — превращайте идеи в готовые картинки за секунды",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/1a386bbe-2098-4e52-ae9c-6ea2394ad03a.jpg",
      icon: "Sparkles",
      path: "/freegeneration",
    },
    {
      id: "perfume-selection",
      title: "Подбор ароматов",
      description:
        "Пять конкретных ароматов под вас: любимые ноты, повод, сезон и стойкость — с разбором пирамиды нот и советами по нанесению",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/90f752ca-05c1-4c77-9628-58a5b1bdd630.jpg",
      icon: "SprayCan",
      path: "/perfume-selection",
    },
    {
      id: "wedding-selection",
      title: "Свадебный образ",
      description:
        "Полный образ для невесты или жениха: наряд, обувь, украшения, аксессуары, макияж и причёска — под вашу внешность, сезон и стиль торжества. С картинкой образа",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/0a618c78-3d6b-407c-a4cf-a0b159ba7356.jpg",
      icon: "Heart",
      path: "/wedding-selection",
    },
    {
      id: "gift-selection",
      title: "Подбор подарков",
      description:
        "Пять идей подарка под получателя и повод: с учётом его интересов, бюджета, знака зодиака и архетипа — с объяснением, почему подойдёт",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/79d4240f-ad68-4269-9998-4f484e0658b2.jpg",
      icon: "Gift",
      path: "/gift-selection",
    },
    {
      id: "divination",
      title: "Гадания на картах",
      description:
        "Расклады Таро и Ленорман с ИИ — повод для размышления и взгляд на ситуацию со стороны",
      image:
        "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/6b7b3c6b-d705-40ee-959a-0af908f8b1b5.jpg",
      icon: "Sparkle",
      path: "/divination",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-800/40 to-gray-900">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="lg:pl-20">
        <header className="border-b border-gray-700/50 sticky top-0 bg-gray-900/50 backdrop-blur z-40">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center justify-between lg:justify-end">
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors z-[60]"
                  aria-label="Toggle menu"
                >
                  <Icon name="Menu" size={24} className="text-white" />
                </button>
                {user && <HeaderBalance variant="light" />}
              </div>

              <Link
                to="/"
                className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:mr-auto flex items-center hover:opacity-80 transition-opacity"
              >
                <img
                  src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/a4cc110d-5cfa-4774-95c7-9239fdfef2c5.svg"
                  alt="StyleSelect"
                  className="h-8 md:h-10"
                />
              </Link>
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <div className="hidden lg:block">
                      <HeaderBalance variant="light" />
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {user.avatar_url ? (
                          <AvatarImage src={user.avatar_url} alt={user.name} />
                        ) : null}
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-sm font-medium">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-300">{user.name}</span>
                    </div>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="hidden lg:flex text-white hover:bg-purple-700 hover:text-white"
                    >
                      <Link to="/profile">
                        <Icon name="User" size={16} className="mr-2" />
                        Личный кабинет
                      </Link>
                    </Button>
                    <Link
                      to="/profile"
                      className="lg:hidden p-1 hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Profile"
                    >
                      <Avatar className="h-8 w-8">
                        {user.avatar_url ? (
                          <AvatarImage src={user.avatar_url} alt={user.name} />
                        ) : null}
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-sm font-medium">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="hidden lg:flex text-white bg-transparent border-white/30 hover:bg-white/10 hover:border-white/50 hover:text-white"
                    >
                      <Icon name="LogOut" size={16} className="mr-2" />
                      Выйти
                    </Button>
                    <button
                      onClick={handleLogout}
                      className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Logout"
                    >
                      <Icon name="LogOut" size={24} className="text-white" />
                    </button>
                  </>
                ) : (
                  <>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="hidden md:flex text-white hover:bg-white/10"
                    >
                      <Link to="/login">Войти</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      className="hidden md:flex text-white hover:opacity-90"
                      style={{ backgroundColor: "rgb(150, 115, 211)" }}
                    >
                      <Link to="/register">Регистрация</Link>
                    </Button>
                    <Link
                      to="/login"
                      className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Login"
                    >
                      <Icon name="User" size={24} className="text-white" />
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </header>

        <main>
          <div className="container mx-auto px-4 py-12">
            <div className="mb-12">
              <h1 className="text-4xl lg:text-4xl font-bold text-white mb-4">
                Ваш идеальный стиль с технологиями ИИ
              </h1>
              <p className="text-gray-300 text-lg mb-3">
                Виртуальная примерка одежды, цветотип, типаж по Кибби и архетип,
                стилевой анализ внешности, подбор образов, ароматов и подарков.
                Создавайте образы, капсулы и лукбуки.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => navigate(service.path)}
                  className="group cursor-pointer flex flex-col bg-gray-800/60 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20"
                >
                  <div className="aspect-video overflow-hidden relative">
                    <img
                      src={service.image}
                      alt={service.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {service.id === "color-guide" && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-500/95 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg">
                        <Icon name="TriangleAlert" size={14} />
                        <span>Тестовый режим • точность ~70%</span>
                      </div>
                    )}
                    {/* Тесты без списания — отмечаем сразу на картинке */}
                    {service.free && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-emerald-500/95 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg">
                        <Icon name="Gift" size={14} />
                        <span>Бесплатно</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 p-5">
                    <div className="w-12 h-12 rounded-full bg-purple-500/25 ring-1 ring-purple-400/40 flex items-center justify-center mb-3 group-hover:bg-purple-500/40 transition-colors">
                      <Icon
                        name={service.icon}
                        size={22}
                        className="text-purple-300"
                      />
                    </div>

                    <h2 className="w-full text-lg font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                      {service.title}
                    </h2>

                    <p className="text-sm text-gray-300 leading-relaxed mb-5">
                      {service.description}
                    </p>

                    <div className="mt-auto">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm group-hover:bg-purple-500 transition-colors">
                        К сервису
                        <Icon name="ArrowRight" size={16} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {knowledgePosts.length > 0 && (
              <div className="mt-16">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-white">База знаний</h2>
                    <p className="text-purple-100 mt-1">
                      Инструкции по сервисам, новости и полезные статьи
                    </p>
                  </div>
                  <Link
                    to="/knowledge"
                    className="hidden sm:flex items-center gap-2 text-purple-400 font-medium hover:gap-3 transition-all"
                  >
                    <span>Все материалы</span>
                    <Icon name="ArrowRight" size={20} />
                  </Link>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                  {knowledgePosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/knowledge/${post.slug}`}
                      className="group cursor-pointer bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-300"
                    >
                      <div className="aspect-video overflow-hidden bg-gray-800">
                        {post.cover_url ? (
                          <img
                            src={post.cover_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon name="Image" size={32} className="text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 mb-2">
                          {knowledgeSectionLabels[post.section] || "Статья"}
                        </span>
                        <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-purple-100 text-sm mt-2 line-clamp-2">{post.excerpt}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-6 sm:hidden">
                  <Link
                    to="/knowledge"
                    className="flex items-center gap-2 text-purple-400 font-medium"
                  >
                    <span>Все материалы</span>
                    <Icon name="ArrowRight" size={20} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>

        <Footer />
        <CookieBanner />
      </div>
    </div>
  );
};

export default Home;