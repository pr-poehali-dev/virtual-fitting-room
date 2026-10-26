import WellnessPage, { WellnessConfig } from "@/components/wellness/WellnessPage";
import { SPORT_FIELDS } from "@/lib/wellnessOptions";
import { SPORT_PLAN_COST } from "@/config/prices";

const config: WellnessConfig = {
  service: "sport",
  title: "Спорт и фитнес",
  subtitle:
    "Тренировки и прогулки на неделю под вашу фигуру, подготовку, свободное время и климат — с заменой для каждого занятия",
  blockTitle: "О тренировках",
  blockIcon: "Dumbbell",
  fields: SPORT_FIELDS,
  buttonLabel: "Составить план",
  buttonIcon: "Dumbbell",
  getCost: () => SPORT_PLAN_COST,
  photoHint: "Фото в полный рост поможет точнее учесть пропорции фигуры. Можно без него.",
  faq: [
    {
      question: "Что если у меня нет бассейна или зала?",
      answer:
        "У каждого занятия в плане есть замена — дома, на улице или без инвентаря.",
    },
    {
      question: "Можно ли с ограничениями по здоровью?",
      answer:
        "Укажите их в анкете — план будет щадящим. Но перед началом тренировок обязательно посоветуйтесь с врачом.",
    },
  ],
};

export default function SportPlan() {
  return <WellnessPage config={config} />;
}
