// Shared building blocks for every tab.
import {useCallback, useEffect, useState, type ComponentType, type ReactNode, type SVGProps} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {Button} from '@astryxdesign/core/Button';
import {useToast} from '@astryxdesign/core/Toast';
import {ExclamationCircleIcon} from '@heroicons/react/24/outline';
import type {useDha} from './lib/useDha';

export type Dha = ReturnType<typeof useDha>;
export type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** A card with a bold title row, the basic unit of every tab. */
export function Panel({title, end, children}: {title?: ReactNode; end?: ReactNode; children: ReactNode}) {
  return (
    <Card padding={5}>
      <VStack gap={4}>
        {title ? (
          <HStack gap={2} vAlign="center" justify="between">
            {typeof title === 'string' ? <Heading level={3}>{title}</Heading> : title}
            {end}
          </HStack>
        ) : null}
        {children}
      </VStack>
    </Card>
  );
}

/** Big page title at the top of a tab. */
export function TabTitle({eyebrow, title, sub, end}: {eyebrow?: ReactNode; title: string; sub?: string; end?: ReactNode}) {
  return (
    <VStack gap={1} paddingInline={1}>
      {eyebrow ? (
        typeof eyebrow === 'string' ? (
          <Text type="supporting" weight="medium">
            {eyebrow}
          </Text>
        ) : (
          eyebrow
        )
      ) : null}
      <HStack gap={2} vAlign="end" justify="between">
        <Heading level={1} textWrap="balance">
          {title}
        </Heading>
        {end}
      </HStack>
      {sub ? <Text type="supporting">{sub}</Text> : null}
    </VStack>
  );
}

/** Label over a large number, used for summary figures. */
export function Figure({label, value, tone = 'primary'}: {label: string; value: string; tone?: 'primary' | 'accent' | 'secondary'}) {
  return (
    <VStack gap={0.5}>
      <Text type="supporting" size="sm">
        {label}
      </Text>
      <Text type="display-3" weight="bold" color={tone} hasTabularNumbers maxLines={1}>
        {value}
      </Text>
    </VStack>
  );
}

export function Loading() {
  return (
    <VStack gap={2}>
      <Skeleton height={20} index={0} />
      <Skeleton height={20} width="65%" index={1} />
    </VStack>
  );
}

export function StoreGate({d, ready, children}: {d: Dha; ready: boolean; children: ReactNode}) {
  if (d.store === 'unavailable')
    return <EmptyState isCompact title="저장소에 연결되지 않았어요" description="claude.ai에 로그인한 상태에서 열면 저장돼요." />;
  if (d.store === 'error') return <EmptyState isCompact title="불러오지 못했어요" description="페이지를 새로 열어 주세요." />;
  if (!ready)
    return d.store === 'slow' ? <Text type="supporting">저장소 연결이 늦어지고 있어요. 네트워크를 확인해 주세요.</Text> : <Loading />;
  return <>{children}</>;
}

/** Inline message that tells the viewer exactly what is missing. */
export function FieldHint({children}: {children: ReactNode}) {
  return (
    <HStack gap={1} vAlign="center">
      <Icon icon={ExclamationCircleIcon} size="sm" color="error" />
      <Text type="supporting" size="sm" color="primary">
        {children}
      </Text>
    </HStack>
  );
}

/**
 * Bottom sheet with a title and one full-width primary action that is never disabled:
 * `onSubmit` returns a message when something is missing, and the sheet shows it.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  cta,
  onSubmit,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  cta: string;
  onSubmit: () => string | void;
  children: ReactNode;
}) {
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) setHint(null);
  }, [isOpen]);
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} label={title} height="hug" purpose="form" padding={5}>
      <VStack gap={5}>
        <Heading level={2}>{title}</Heading>
        <VStack gap={4}>{children}</VStack>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
        <Button
          label={cta}
          variant="primary"
          size="lg"
          width="100%"
          onClick={() => {
            const msg = onSubmit();
            setHint(msg || null);
          }}
        />
      </VStack>
    </BottomSheet>
  );
}

/** Full-width call to action at the end of a tab. */
export function Cta({label, icon, onClick}: {label: string; icon?: ReactNode; onClick: () => void}) {
  return <Button label={label} icon={icon} variant="primary" size="lg" width="100%" onClick={onClick} />;
}

/** Confirmation toast after a save, with an optional "실행 취소". */
export function useNotify() {
  const showToast = useToast();
  return useCallback(
    (body: string, undo?: () => void) => {
      let dismiss: () => void = () => {};
      dismiss = showToast({
        body,
        type: 'info',
        autoHideDuration: undo ? 6000 : 3500,
        endContent: undo ? (
          <Button
            label="실행 취소"
            variant="ghost"
            size="sm"
            onClick={() => {
              undo();
              dismiss();
            }}
          />
        ) : undefined,
      });
    },
    [showToast],
  );
}

// ---- smart defaults kept per viewer in this browser ----
export function remember<T>(key: string, value: T) {
  try {
    localStorage.setItem('dha-last-' + key, JSON.stringify(value));
  } catch {
    /* per-viewer convenience only */
  }
}
export function recall<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('dha-last-' + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
