import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const reviews = [
  {
    name: "Sarah K.",
    text: "Amazing quality! The delivery was super fast and the product exceeded my expectations. Will definitely order again!",
    rating: 5,
    avatar: "SK",
  },
  {
    name: "Ahmed R.",
    text: "Best online shopping experience. Great prices, authentic products, and excellent customer support.",
    rating: 5,
    avatar: "AR",
  },
  {
    name: "Priya M.",
    text: "I love the variety of products. The return policy gives me confidence to shop here without worry.",
    rating: 4,
    avatar: "PM",
  },
  {
    name: "Tanvir H.",
    text: "Very fast delivery in Dhaka. Product quality is top-notch. Highly recommended for everyone!",
    rating: 5,
    avatar: "TH",
  },
];

export const CustomerReviews = () => {
  const { t } = useLanguage();

  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground">
            {t("customerReviews")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("realReviews")}</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-5 relative"
            >
              <Quote className="absolute top-4 right-4 w-6 h-6 text-primary/10" />
              <div className="flex items-center gap-0.5 mb-3">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                  {review.avatar}
                </div>
                <span className="font-display font-semibold text-sm text-foreground">
                  {review.name}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
