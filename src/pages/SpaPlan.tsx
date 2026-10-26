import WellnessPage, { WellnessConfig } from "@/components/wellness/WellnessPage";
import { SPA_FIELDS } from "@/lib/wellnessOptions";
import { SPA_WEEK_COST, SPA_MONTH_COST } from "@/config/prices";

const config: WellnessConfig = {
  service: "spa",
  title: "SPA-уход",
  subtitle:
    "Программа ухода за лицом, телом и волосами на неделю или месяц — с учётом кожи, климата, сезона и бюджета",
  blockTitle: "Об уходе",
  blockIcon: "Flower2",
  fields: SPA_FIELDS,
  buttonLabel: "Составить программу",
  buttonIcon: "Flower2",
  getCost: (v) => (v.period === "Месяц" ? SPA_MONTH_COST : SPA_WEEK_COST),
  photoHint: "Портрет без макияжа при дневном свете поможет точнее оценить кожу. Можно без него.",
  faq: [
    {
      question: "Сколько стоит программа?",
      answer: `На неделю — ${SPA_WEEK_COST} ₽, на месяц — ${SPA_MONTH_COST} ₽.`,
    },
    {
      question: "Нужно ли покупать дорогие средства?",
      answer:
        "Нет. Укажите бюджет и что уже есть дома — в программе будут доступные средства и простые домашние рецепты.",
    },
  ],
};

export default function SpaPlan() {
  return <WellnessPage config={config} />;
}
