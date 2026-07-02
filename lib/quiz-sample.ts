/**
 * Готовый пример квиз-воронки (по реальному сайту bilimdibol.eng / arsenquiz).
 * Тексты на казахском — дословно из квиза заказчика.
 */

export interface QuizQuestion {
  q: string;
  options: string[];
}

export interface QuizContent {
  logo: string;
  title: string;
  subtitle: string;
  startButton: string;
  questions: QuizQuestion[];
  buttonText: string; // финальная кнопка отправки
  thanksText: string;
  socials: { instagram?: string; telegram?: string; tiktok?: string };
}

export const ARSEN_QUIZ: QuizContent = {
  logo: "bilimdibol.eng",
  title: "2 айда ағылшын тілінде сөйлеп үйреніңіз",
  subtitle:
    "5 сұраққа жауап беріңіз — сізге ыңғайлы оқу бағдарламасын таңдап, маманымыз хабарласады.",
  startButton: "Бастау",
  questions: [
    {
      q: "Ағылшын тілін не үшін үйренгіңіз келеді?",
      options: ["Жоғары жалақы", "Шетелде оқу / жұмыс", "Еркін саяхаттау"],
    },
    {
      q: "Сіздің қазіргі деңгейіңіз қандай?",
      options: [
        "Beginner — 0-ден бастау керек",
        "Elementary — кейбір сөздерді түсінемін",
        "Pre-Intermediate — түсінемін, бірақ сөйлей алмаймын",
        "Intermediate — акцент пен ойды жеткізуде қиналамын",
      ],
    },
    {
      q: "Ағылшын тілін үйренуге қанша уақыт бөле аласыз?",
      options: ["Күніне 1 сағат", "Күніне 30 минут", "Уақыт жоқ, бірақ үйренгім келеді"],
    },
    {
      q: "Қанша уақыттан бері ағылшын тілін үйреніп жүрсіз?",
      options: [
        "1 жылдан көп, бірақ нәтиже жоқ",
        "6 ай болды, бірақ сөйлей алмаймын",
        "Жақында ғана бастадым",
      ],
    },
    {
      q: "Ағылшын тілі 2 айда нақты нәтиже беретінін дәлелдеп берсек, дайынсыз ба?",
      options: ["Иә, дәл қазір бастаймын", "Иә, бірақ күмәнім бар", "Жоқ, өзгеріс қаламаймын"],
    },
  ],
  buttonText: "Жауаптарды жіберу",
  thanksText: "Рахмет! Жақын арада сізбен хабарласамыз.",
  socials: {},
};

/** Безопасно привести jsonb-вопросы к массиву QuizQuestion. */
export function parseQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const o = x as { q?: unknown; options?: unknown };
      return {
        q: typeof o.q === "string" ? o.q : "",
        options: Array.isArray(o.options) ? o.options.map((s) => String(s)).filter(Boolean) : [],
      };
    })
    .filter((x) => x.q || x.options.length);
}
