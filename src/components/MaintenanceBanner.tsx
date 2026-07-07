import Icon from "@/components/ui/icon";

const SHOW_MAINTENANCE_BANNER = false;

const MaintenanceBanner = () => {
  if (!SHOW_MAINTENANCE_BANNER) return null;

  return (
    <div className="w-full bg-red-600 text-white text-sm md:text-base px-4 py-2 flex items-center justify-center gap-2 text-center">
      <Icon name="TriangleAlert" size={18} className="shrink-0" />
      <span>
        Внимание: в данный момент наблюдаются технические неполадки в работе
        нейросети. Генерация может быть временно недоступна — пожалуйста,
        попробуйте позже. Приносим извинения за неудобства.
      </span>
    </div>
  );
};

export default MaintenanceBanner;