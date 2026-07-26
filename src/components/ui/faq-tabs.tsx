"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export type FAQItemData = {
  question: string;
  answer: string;
};

export type FAQCategories = Record<string, string>;
export type FAQData = Record<string, FAQItemData[]>;

type FAQProps = {
  title?: string;
  subtitle?: string;
  categories: FAQCategories;
  faqData: FAQData;
  className?: string;
} & React.ComponentPropsWithoutRef<"section">;

export function FAQ({
  title = "Perguntas frequentes",
  subtitle = "Central de Ajuda",
  categories,
  faqData,
  className,
  ...props
}: FAQProps) {
  const categoryKeys = Object.keys(categories);
  const [selectedCategory, setSelectedCategory] = useState(categoryKeys[0] ?? "");

  return (
    <section
      className={cn(
        "relative overflow-hidden bg-background px-4 py-12 text-foreground sm:px-5 lg:px-6",
        className,
      )}
      {...props}
    >
      <FAQHeader title={title} subtitle={subtitle} />
      <FAQTabs
        categories={categories}
        selected={selectedCategory}
        setSelected={setSelectedCategory}
      />
      <FAQList faqData={faqData} selected={selectedCategory} />
    </section>
  );
}

function FAQHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center text-center">
      <span className="mb-6 bg-gradient-to-r from-[#ff1493] to-[#ff7ec8] bg-clip-text text-sm font-semibold uppercase tracking-[0.18em] text-transparent">
        {subtitle}
      </span>
      <h1 className="mb-8 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      <span className="absolute -top-[350px] left-[50%] z-0 h-[500px] w-[600px] -translate-x-[50%] rounded-full bg-gradient-to-r from-[#ff1493]/15 to-[#ff1493]/5 blur-3xl" />
    </div>
  );
}

function FAQTabs({
  categories,
  selected,
  setSelected,
}: {
  categories: FAQCategories;
  selected: string;
  setSelected: (key: string) => void;
}) {
  return (
    <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
      {Object.entries(categories).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setSelected(key)}
          className={cn(
            "relative overflow-hidden whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-500",
            selected === key
              ? "border-[#ff1493] text-white"
              : "border-white/12 bg-transparent text-white/55 hover:text-white",
          )}
        >
          <span className="relative z-10">{label}</span>
          <AnimatePresence>
            {selected === key && (
              <motion.span
                initial={{ y: "100%" }}
                animate={{ y: "0%" }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.5, ease: "backIn" }}
                className="absolute inset-0 z-0 bg-gradient-to-r from-[#ff1493] to-[#ff5cb8]"
              />
            )}
          </AnimatePresence>
        </button>
      ))}
    </div>
  );
}

function FAQList({ faqData, selected }: { faqData: FAQData; selected: string }) {
  return (
    <div className="mx-auto mt-12 max-w-3xl">
      <AnimatePresence mode="wait">
        {Object.entries(faqData).map(([category, questions]) => {
          if (selected !== category) return null;

          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "backIn" }}
              className="space-y-4"
            >
              {questions.map((faq) => (
                <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function FAQItem({ question, answer }: FAQItemData) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      animate={isOpen ? "open" : "closed"}
      className={cn(
        "rounded-xl border transition-colors",
        isOpen ? "border-white/14 bg-white/[0.06]" : "border-white/10 bg-white/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "text-base font-medium transition-colors sm:text-lg",
            isOpen ? "text-white" : "text-white/70",
          )}
        >
          {question}
        </span>
        <motion.span
          variants={{
            open: { rotate: "45deg" },
            closed: { rotate: "0deg" },
          }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <Plus
            className={cn(
              "h-5 w-5 transition-colors",
              isOpen ? "text-white" : "text-white/45",
            )}
          />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : "0px",
          marginBottom: isOpen ? "16px" : "0px",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden px-4"
      >
        <p className="text-sm leading-6 text-white/60 sm:text-base">{answer}</p>
      </motion.div>
    </motion.div>
  );
}
