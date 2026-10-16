// Ícones do Phosphor com os nomes usados no código (antes Lucide, o padrão de todo site feito por IA).
// Um lugar só: trocar a família de ícones de novo é editar este arquivo.
import {
  ArrowLeft as SetaEsquerda,
  ArrowRight as SetaDireita,
  ArrowUpRight as SetaFora,
  type Icon,
  type IconProps,
} from '@phosphor-icons/react'
import { createElement, forwardRef } from 'react'

// Setas marcadas com data-seta: o CSS (index.css) faz a seta andar na direção dela quando o link ou
// botão em volta recebe o mouse, em todo o site, sem classe extra em cada tela.
function seta(Base: Icon, direcao: 'frente' | 'tras' | 'fora'): Icon {
  const Seta = forwardRef<SVGSVGElement, IconProps>((props, ref) => createElement(Base, { ...props, ref, 'data-seta': direcao } as IconProps))
  Seta.displayName = Base.displayName
  return Seta as Icon
}
export const ArrowRight = seta(SetaDireita, 'frente')
export const ArrowLeft = seta(SetaEsquerda, 'tras')
export const ExternalLink = seta(SetaFora, 'fora')

export {
  SealCheck as BadgeCheck,
  BookOpen,
  BookOpenText,
  Robot as Bot,
  Brain,
  CalendarCheck,
  CalendarDots as CalendarClock,
  CalendarBlank as CalendarDays,
  Camera,
  ChartBar as ChartColumn,
  Check,
  WarningCircle as CircleAlert,
  CheckCircle as CircleCheck,
  Question as CircleHelp,
  XCircle as CircleX,
  ClipboardText as ClipboardCheck,
  Clock,
  Code as CodeXml,
  Coffee,
  Compass,
  DownloadSimple as Download,
  Barbell as Dumbbell,
  FileText,
  Fire as Flame,
  FolderPlus,
  GraduationCap,
  House,
  Cards as Layers,
  Books as Library,
  Lightbulb,
  ListChecks,
  Playlist as ListVideo,
  CircleNotch as Loader2,
  LockSimple as Lock,
  SignOut as LogOut,
  ChatCircleText as MessageCircle,
  Minus,
  Moon,
  Confetti as PartyPopper,
  Pause,
  PencilSimple as Pencil,
  Play,
  Plus,
  PlayCircle,
  ArrowCounterClockwise as RotateCcw,
  Path as Route,
  FloppyDisk as Save,
  MagnifyingGlass as Search,
  PaperPlaneRight as Send,
  ShieldWarning as ShieldAlert,
  ShieldCheck,
  Sparkle as Sparkles,
  Sun,
  Target,
  Timer,
  Trash as Trash2,
  TrendDown as TrendingDown,
  Trophy,
  ArrowUUpLeft as Undo2,
  UploadSimple as Upload,
  User as UserRound,
  X,
} from '@phosphor-icons/react'

export type { Icon as Icone } from '@phosphor-icons/react'
