import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface FaqItem {
  question: string;
  answer: ReactNode;
}

interface FaqAccordionProps {
  title?: string;
  items: FaqItem[];
  className?: string;
}

export default function FaqAccordion({
  title = "Часто задаваемые вопросы",
  items,
  className = "",
}: FaqAccordionProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`max-w-3xl mx-auto mt-16 mb-12 ${className}`}>
      <h2 className="text-3xl font-bold text-center mb-8">{title}</h2>
      <Card>
        <CardContent className="p-6">
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
