import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Icon from '@/components/ui/icon';

const Home = () => {
  const navigate = useNavigate();

  const services = [
    {
      id: 'virtual-fitting',
      title: 'Виртуальная примерочная',
      description: 'Примерьте одежду онлайн с помощью ИИ — загрузите своё фото и посмотрите, как на вас сидит выбранная вещь',
      image: 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/f7c99362-695d-4d4e-8698-72caccb13098.jpg',
      icon: 'Shirt',
      path: '/virtualfitting',
    },
    {
      id: 'color-type',
      title: 'Определение цветотипа',
      description: 'Узнайте свой цветотип и получите персональные рекомендации по цветам в одежде и макияже',
      image: 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/2ed4e10a-bc8e-4e95-a3a3-5cfda871484a.jpg',
      icon: 'Palette',
      path: '/colortype',
    },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Sidebar />
      
      <div className="flex-1 lg:ml-20 p-6 lg:p-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Добро пожаловать в AI Fashion Studio
            </h1>
            <p className="text-gray-300 text-lg">
              Выберите сервис для работы с вашим стилем
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => navigate(service.path)}
                className="group cursor-pointer bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                <div className="p-6 lg:p-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                      <Icon name={service.icon} size={24} className="text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">
                      {service.title}
                    </h2>
                  </div>
                  
                  <p className="text-gray-300 leading-relaxed">
                    {service.description}
                  </p>
                  
                  <div className="mt-6 flex items-center gap-2 text-purple-400 font-medium group-hover:gap-3 transition-all">
                    <span>Перейти к сервису</span>
                    <Icon name="ArrowRight" size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
