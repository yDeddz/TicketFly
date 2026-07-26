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
  /** Smaller title, spacing and accordion for home teaser. */
  compact?: boolean;
} & React.ComponentPropsWithoutRef<"section">;

export function FAQ({
  title = "Perguntas frequentes",
  subtitle = "Central de Ajuda",
  categories,
  faqData,
  className,
  compact = false,
  ...props
}: FAQProps) {
  const categoryKeys = Object.keys(categories);
  const [selectedCategory, setSelectedCategory] = useState(categoryKeys[0] ?? "");

  return (
    <section
      className={cn(
        "relative overflow-hidden bg-background text-foreground",
        compact ? "px-0 py-0" : "px-4 py-12 sm:px-5 lg:px-6",
        className,
      )}
      {...props}
    >
      <FAQHeader title={title} subtitle={subtitle} compact={compact} />
      <FAQTabs
        categories={categories}
        selected={selectedCategory}
        setSelected={setSelectedCategory}
        compact={compact}
      />
      <FAQList faqData={faqData} selected={selectedCategory} compact={compact} />
    </section>
  );
}

function FAQHeader({
  title,
  subtitle,
  compact,
}: {
  title: string;
  subtitle: string;
  compact: boolean;
}) {
  const TitleTag = compact ? "h2" : "h1";

  return (
    <div className="relative z-10 flex flex-col items-center justify-center text-center">
      <span
        className={cn(
          "bg-gradient-to-r from-[#ff1493] to-[#ff7ec8] bg-clip-text font-semibold uppercase tracking-[0.18em] text-transparent",
          compact ? "mb-3 text-xs" : "mb-6 text-sm",
        )}
      >
        {subtitle}
      </span>
      <TitleTag
        className={cn(
          "max-w-3xl font-bold tracking-tight",
          compact ? "mb-5 text-2xl sm:text-3xl" : "mb-8 text-4xl sm:text-5xl",
        )}
      >
        {title}
      </TitleTag>
      {!compact ? (
        <span className="absolute -top-[350px] left-[50%] z-0 h-[500px] w-[600px] -translate-x-[50%] rounded-full bg-gradient-to-r from-[#ff1493]/15 to-[#ff1493]/5 blur-3xl" />
      ) : null}
    </div>
  );
}

function FAQTabs({
  categories,
  selected,
  setSelected,
  compact,
}: {
  categories: FAQCategories;
  selected: string;
  setSelected: (key: string) => void;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "relative z-10 flex flex-wrap items-center justify-center",
        compact ? "gap-2" : "gap-3",
      )}
    >
      {Object.entries(categories).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setSelected(key)}
          className={cn(
            "relative overflow-hidden whitespace-nowrap rounded-md border font-medium transition-colors duration-500",
            compact ? "px-2.5 py-1 text-xs sm:text-sm" : "px-3 py-1.5 text-sm",
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

function FAQList({
  faqData,
  selected,
  compact,
}: {
  faqData: FAQData;
  selected: string;
  compact: boolean;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl", compact ? "mt-6" : "mt-12")}>
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
              className={cn(compact ? "space-y-2.5" : "space-y-4")}
            >
              {questions.map((faq) => (
                <FAQItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  compact={compact}
                />
              ))}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function FAQItem({
  question,
  answer,
  compact = false,
}: FAQItemData & { compact?: boolean }) {
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
        className={cn(
          "flex w-full items-center justify-between gap-4 text-left",
          compact ? "p-3.5" : "p-4",
        )}
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "font-medium transition-colors",
            compact ? "text-sm sm:text-base" : "text-base sm:text-lg",
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
              "transition-colors",
              compact ? "h-4 w-4" : "h-5 w-5",
              isOpen ? "text-white" : "text-white/45",
            )}
          />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : "0px",
          marginBottom: isOpen ? (compact ? "12px" : "16px") : "0px",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden px-4"
      >
        <p
          className={cn(
            "leading-6 text-white/60",
            compact ? "text-sm" : "text-sm sm:text-base",
          )}
        >
          {answer}
        </p>
      </motion.div>
    </motion.div>
  );
}
