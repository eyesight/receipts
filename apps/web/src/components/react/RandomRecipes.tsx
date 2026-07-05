import { useState, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, A11y } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";

type Recipe = {
  slug: string;
  title: string;
  image?: string;
  category?: string;
};

type Props = {
  recipes: Recipe[];
};

function getRandomItems<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

export default function RandomRecipes({ recipes }: Props) {
  const [items, setItems] = useState(() =>
    getRandomItems(recipes, Math.min(10, recipes.length))
  );

  const randomize = useCallback(() => {
    setItems(getRandomItems(recipes, Math.min(10, recipes.length)));
  }, [recipes]);

  if (recipes.length === 0) return null;

  return (
    <section className="mt-24">
      <button
        onClick={randomize}
        type="button"
        className="btn-random"
        style={{ marginBottom: "var(--spacing-s)" }}
      >
        <span>Zufallsrezepte</span>
        <svg
          className="btn-random__icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 29.49 25.499"
        >
          <g transform="translate(-0.61 -4.942)">
            <path
              d="M10.074,19.038A11.735,11.735,0,1,1,13.435,26"
              transform="translate(-4.39)"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M2,23l3.684,5.389,4.88-4.487"
              transform="translate(0 -9.351)"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </g>
        </svg>
      </button>

      <Swiper
        modules={[EffectCoverflow, A11y]}
        loop={items.length > 1}
        speed={800}
        slidesPerView="auto"
        centeredSlides={true}
        effect="coverflow"
        coverflowEffect={{
          rotate: 0,
          stretch: 20,
          depth: 100,
          modifier: 5,
          slideShadows: false,
        }}
        slideToClickedSlide={true}
        a11y={{ enabled: true }}
        className="w-full"
      >
        {items.map((recipe, index) => (
          <SwiperSlide
            key={`${recipe.slug}-${index}`}
            style={{ width: "60%", maxWidth: "560px" }}
          >
            <div className="px-3">
              <a href={`/recipes/${recipe.slug}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                {recipe.image && (
                  <div className="tile-image" style={{ aspectRatio: "91/51", background: "#fff" }}>
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                )}
                <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                  <h2
                    className="swiper-slide-title"
                    style={{
                      fontFamily: '"Lora", serif',
                      fontSize: "var(--font-h3)",
                      fontWeight: 500,
                      lineHeight: 1.25,
                      transition: "color 0.2s ease",
                    }}
                  >
                    {recipe.title}
                  </h2>
                  {recipe.category && (
                    <span
                      className="tag-link"
                      style={{ fontSize: "0.875rem", marginTop: "0.5rem", display: "inline-block" }}
                    >
                      {recipe.category}
                    </span>
                  )}
                </div>
              </a>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
