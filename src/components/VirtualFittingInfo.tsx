import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Icon from '@/components/ui/icon';

export default function VirtualFittingInfo() {
  return (
    <>
      <section id="guide" className="py-20 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl font-light text-center mb-12">
            Как пользоваться примерочной
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Upload" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">1. Загрузите фото</h3>
              <p className="text-muted-foreground text-sm">
                Выберите чёткую фотографию в полный рост на светлом фоне
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Shirt" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">2. Выберите одежду</h3>
              <p className="text-muted-foreground text-sm">
                Выберите из каталога или загрузите своё фото одежды
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Sparkles" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">3. Получите результат</h3>
              <p className="text-muted-foreground text-sm">
                AI создаст реалистичное изображение с выбранной одеждой
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl font-light text-center mb-12">
            Часто задаваемые вопросы
          </h2>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Какие требования к фотографии?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Фотография должна быть чёткой, в полный рост, на светлом однородном фоне. 
                Человек должен быть в облегающей одежде или спортивной форме для лучшего результата.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Как работает технология?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Мы используем передовые AI модели машинного обучения (GAN) и компьютерного зрения 
                для реалистичного наложения одежды на фигуру с учётом освещения и пропорций.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Сколько времени занимает генерация?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Процесс состоит из нескольких этапов:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Предобработка:</strong> 3-5 секунд на каждое изображение (удаление фона)</li>
                  <li><strong>Примерка:</strong> 10-20 секунд на каждый элемент одежды</li>
                  <li><strong>Итого:</strong> при выборе 3 элементов ~45-75 секунд</li>
                </ul>
                <p className="mt-2 text-sm">Первый запуск может быть медленнее (~1-2 минуты) из-за загрузки AI моделей.</p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Можно ли использовать свою одежду?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Да! Откройте раздел "Загрузить своё фото" и добавьте изображение.</p>
                <p className="mb-2"><strong>Хорошая новость:</strong> фон удаляется автоматически! Можете загружать:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Фото с любым фоном (будет удалён автоматически)</li>
                  <li>Фото манекена в одежде (AI выделит нужный элемент)</li>
                  <li>Профессиональные фото товаров</li>
                </ul>
                <p className="mt-2"><strong>Новая функция:</strong> используйте кнопку <strong>"Кадрировать"</strong> чтобы выделить нужную часть одежды - это повышает точность!</p>
                <p className="mt-2"><strong>Важно:</strong> предмет должен быть виден полностью, выберите правильную категорию.</p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Что делать, если результат неточный?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Основные причины неточностей:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Обрезанные элементы:</strong> если брюки обрезаны снизу на фото, AI может принять их за шорты</li>
                  <li><strong>Фото человека:</strong> должно быть в полный рост, чёткое, на светлом фоне</li>
                  <li><strong>Неправильная категория:</strong> убедитесь что выбрана правильная категория одежды</li>
                  <li><strong>Низкое качество:</strong> размытые или тёмные фото снижают точность</li>
                </ul>
                <p className="mt-2 text-sm"><strong>Совет:</strong> используйте <strong>кадрирование</strong> для загруженных фото - выделите только нужную часть одежды для лучшего результата!</p>
                <p className="mt-2 text-sm"><strong>Помните:</strong> фон удаляется автоматически, не переживайте если он не идеальный!</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 Virtual Fitting. Технология виртуальной примерочной на базе AI
          </p>
        </div>
      </footer>
    </>
  );
}
