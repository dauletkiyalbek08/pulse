import {
  GraduationCap,
  ShoppingBag,
  Boxes,
  Home,
  Users,
  Filter,
  BookOpen,
  ShoppingCart,
  Contact,
  Phone,
  Target,
  UsersRound,
  Megaphone,
  Image as ImageIcon,
  LineChart,
  Share2,
  Webhook,
  Layers,
  Sparkles,
  Bot,
  Puzzle,
  Wallet,
  Coins,
  CalendarCheck,
  CalendarClock,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  Package,
  Music2,
  Circle,
  CircleUser,
  type LucideIcon,
} from "lucide-react";

/** Иконки проектов по ключу (projects.icon). */
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  graduation: GraduationCap,
  shopping: ShoppingBag,
  custom: Layers,
};

export function getProjectIcon(key: string | null | undefined): LucideIcon {
  if (key && key in PROJECT_ICONS) return PROJECT_ICONS[key];
  return Boxes;
}

/** Иконки пунктов бокового меню (см. lib/menu). */
export const MENU_ICONS: Record<string, LucideIcon> = {
  home: Home,
  my: CircleUser,
  leads: Users,
  funnel: Filter,
  trials: BookOpen,
  sales: ShoppingCart,
  clients: Contact,
  calls: Phone,
  hunter: Target,
  team: UsersRound,
  ads: Megaphone,
  creatives: ImageIcon,
  marketing: LineChart,
  smm: Share2,
  capi: Webhook,
  resources: Layers,
  ai: Sparkles,
  chatbot: Bot,
  integrations: Puzzle,
  finance: Wallet,
  salaries: Coins,
  attendance: CalendarCheck,
  schedules: CalendarClock,
  contracts: FileText,
  reports: BarChart3,
  settings: Settings,
  access: ShieldCheck,
  products: Package,
  tiktok: Music2,
};

export function getMenuIcon(key: string): LucideIcon {
  return MENU_ICONS[key] ?? Circle;
}
