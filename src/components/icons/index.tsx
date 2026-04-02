import React from 'react';
import type { SvgProps } from 'react-native-svg';

import { Compass } from './Compass';
import { PlusCircle } from './PlusCircle';
import { ClipboardList } from './ClipboardList';
import { User } from './User';
import { Star } from './Star';
import { Clock } from './Clock';
import { MapPin } from './MapPin';
import { Package } from './Package';
import { AlertTriangle } from './AlertTriangle';
import { ShieldAlert } from './ShieldAlert';
import { Receipt } from './Receipt';
import { QrCode } from './QrCode';
import { Fuel } from './Fuel';
import { Construction } from './Construction';
import { CircleDot } from './CircleDot';
import { Navigation } from './Navigation';
import { Search } from './Search';
import { Filter } from './Filter';
import { Phone } from './Phone';
import { X } from './X';
import { ChevronLeft } from './ChevronLeft';
import { ChevronRight } from './ChevronRight';
import { ExternalLink } from './ExternalLink';
import { Bell } from './Bell';
import { Send } from './Send';
import { MessageCircle } from './MessageCircle';

export interface IconProps extends Omit<SvgProps, 'width' | 'height'> {
  size?: number;
  color?: string;
}

// Re-export all icons
export { Compass } from './Compass';
export { PlusCircle } from './PlusCircle';
export { ClipboardList } from './ClipboardList';
export { User } from './User';
export { Star } from './Star';
export { Clock } from './Clock';
export { MapPin } from './MapPin';
export { Package } from './Package';
export { AlertTriangle } from './AlertTriangle';
export { ShieldAlert } from './ShieldAlert';
export { Receipt } from './Receipt';
export { QrCode } from './QrCode';
export { Fuel } from './Fuel';
export { Construction } from './Construction';
export { CircleDot } from './CircleDot';
export { Navigation } from './Navigation';
export { Search } from './Search';
export { Filter } from './Filter';
export { Phone } from './Phone';
export { X } from './X';
export { ChevronLeft } from './ChevronLeft';
export { ChevronRight } from './ChevronRight';
export { ExternalLink } from './ExternalLink';
export { Bell } from './Bell';
export { Send } from './Send';

const iconMap = {
  compass: Compass,
  'plus-circle': PlusCircle,
  'clipboard-list': ClipboardList,
  user: User,
  star: Star,
  clock: Clock,
  'map-pin': MapPin,
  package: Package,
  'alert-triangle': AlertTriangle,
  'shield-alert': ShieldAlert,
  receipt: Receipt,
  'qr-code': QrCode,
  fuel: Fuel,
  construction: Construction,
  'circle-dot': CircleDot,
  navigation: Navigation,
  search: Search,
  filter: Filter,
  phone: Phone,
  x: X,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'external-link': ExternalLink,
  bell: Bell,
  send: Send,
  'message-circle': MessageCircle,
} as const;

export type IconName = keyof typeof iconMap;

interface IconComponentProps extends IconProps {
  name: IconName;
}

/** Unified icon component: <Icon name="compass" size={24} color="#656e5e" /> */
export function Icon({ name, ...props }: IconComponentProps) {
  const Component = iconMap[name];
  return <Component {...props} />;
}
