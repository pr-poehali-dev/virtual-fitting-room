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
                Выберите фотографию человека в полный рост
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Shirt" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">2. Выберите одну вещь</h3>
              <p className="text-muted-foreground text-sm">
                Выберите один образ из каталога или загрузите своё фото
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Sparkles" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">3. Получите результат</h3>
              <p className="text-muted-foreground text-sm">
                AI создаст реалистичное изображение с выбранным образом
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
                Фотография должна быть чёткой, желательно в полный рост. 
                Человек может быть в любой одежде — AI автоматически заменит её на выбранный образ.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Как работает технология?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Мы используем передовые AI модели машинного обучения (IDM-VTON) 
                для реалистичного наложения одежды на фигуру с учётом освещения, пропорций и драпировки ткани.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Сколько времени занимает генерация?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Процесс занимает 10-30 секунд:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Загрузка моделей:</strong> 3-5 секунд</li>
                  <li><strong>Примерка:</strong> 10-20 секунд</li>
                </ul>
                <p className="mt-2 text-sm">Первый запуск может быть медленнее (~40-60 секунд) из-за инициализации AI моделей.</p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Можно ли использовать свою одежду?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Да! Откройте раздел "Загрузить свою" и добавьте изображение.</p>
                <p className="mb-2"><strong>Важно:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Загружайте фото одежды с любым фоном (необязательно белый)</li>
                  <li>Можно загружать полные образы (вся одежда целиком)</li>
                  <li>Предмет должен быть виден полностью и чётко</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Что делать, если результат неточный?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Основные причины неточностей:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Фото человека:</strong> должно быть чётким, желательно в полный рост</li>
                  <li><strong>Фото одежды:</strong> должно быть качественным и чётким</li>
                  <li><strong>Низкое качество:</strong> размытые или тёмные фото снижают точность</li>
                  <li><strong>Сложная поза:</strong> человек должен стоять прямо</li>
                </ul>
                <p className="mt-2 text-sm"><strong>Совет:</strong> используйте качественные фото с хорошим освещением для лучшего результата!</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Можно ли примерить несколько вещей сразу?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Сейчас можно примерить только одну вещь или полный образ за раз.</p>
                <p>Для создания полного образа используйте фото с комплектом одежды из каталога (топ+брюки, платье и т.д.).</p>
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
