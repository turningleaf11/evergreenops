import {
  Building2, Code2, Palette, Lightbulb, Megaphone, Settings,
  Briefcase, DollarSign, Heart, Shield, Truck, Wrench,
  BarChart3, Globe, Phone, GraduationCap, Scale, Home,
  Layers, Target, Zap, Users, Headphones, ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  Building2,
  Code2,
  Palette,
  Lightbulb,
  Megaphone,
  Settings,
  Briefcase,
  DollarSign,
  Heart,
  Shield,
  Truck,
  Wrench,
  BarChart3,
  Globe,
  Phone,
  GraduationCap,
  Scale,
  Home,
  Layers,
  Target,
  Zap,
  Users,
  Headphones,
  ShoppingCart,
};

export function getDeptIcon(iconName: string | null | undefined): LucideIcon {
  return DEPARTMENT_ICONS[iconName || "Building2"] || Building2;
}
