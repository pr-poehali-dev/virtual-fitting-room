import WellnessPage, { WellnessConfig } from "@/components/wellness/WellnessPage";
import { NUTRITION_FIELDS } from "@/lib/wellnessOptions";
import { NUTRITION_PLAN_COST } from "@/config/prices";

const config: WellnessConfig = {
  service: "nutrition",
  title: "План питания",
  subtitle:
    "Меню на неделю со списком покупок — только из продуктов, которые реально купить в вашем городе и в этот сезон",
  blockTitle: "О питании",
  blockIcon: "Salad",
  fields: NUTRITION_FIELDS,
  buttonLabel: "Составить меню",
  buttonIcon: "Salad",
  getCost: () => NUTRITION_PLAN_COST,
  photoHint: "Фото необязательно — меню составляется по анкете.",
  faq: [
    {
      question: "Что если какого-то продукта нет в моём городе?",
      answer:
        "Укажите город и где покупаете продукты — меню будет из доступного. Для редких продуктов в плане есть замены.",
    },
    {
      question: "Учитывается ли группа крови?",
      answer:
        "Да, как пожелание. Но научных подтверждений у «диеты по группе крови» нет, поэтому основа плана — ваша цель, здоровье и предпочтения.",
    },
  ],
};

export default function NutritionPlan() {
  return <WellnessPage config={config} />;
}
