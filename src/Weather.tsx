// 오늘 날씨: live temperature, rain chance and air quality for 대전 서구; a plain link when
// the page can't reach the weather service (e.g. inside the claude.ai frame).
import {useEffect, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowTopRightOnSquareIcon} from '@heroicons/react/24/outline';
import {cachedWeather, describe, fetchWeather, pmGrade, PLACE, tip, WEATHER_LINK, type Weather} from './lib/weather';
import {clock} from './lib/dates';
import {REFRESH_EVENT} from './lib/refresh';
import {Loading, Panel} from './ui';

export function WeatherCard() {
  const [w, setW] = useState<Weather | null>(cachedWeather);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = (force: boolean) =>
      fetchWeather(force)
        .then((x) => alive && (setW(x), setFailed(false)))
        .catch(() => alive && setFailed(true));
    load(false);
    const onRefresh = () => load(true);
    const onVisible = () => document.visibilityState === 'visible' && load(false);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener(REFRESH_EVENT, onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const link = <Button label="네이버 날씨에서 보기" variant="ghost" size="sm" icon={<Icon icon={ArrowTopRightOnSquareIcon} />} href={WEATHER_LINK} target="_blank" />;
  const meta = w ? (
    <Text type="supporting" size="xsm">
      {PLACE.name} · {clock(w.at)} 기준
    </Text>
  ) : undefined;

  if (!w)
    return (
      <Panel title="오늘 날씨">
        {failed ? (
          <VStack gap={2}>
            <Text type="supporting">이 화면에서는 날씨를 불러올 수 없어요.</Text>
            {link}
          </VStack>
        ) : (
          <Loading />
        )}
      </Panel>
    );

  const sky = describe(w.code);
  const advice = tip(w);
  const air = [pmGrade('pm10', w.pm10) && `미세먼지 ${pmGrade('pm10', w.pm10)}`, pmGrade('pm25', w.pm25) && `초미세먼지 ${pmGrade('pm25', w.pm25)}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <Panel title="오늘 날씨" end={meta}>
      <HStack gap={3} vAlign="center">
        <Text type="display-2" hasTabularNumbers>
          {sky.e} {w.temp}°
        </Text>
        <VStack gap={0.5}>
          <Text type="large">
            {sky.l} · 체감 {w.feels}°
          </Text>
          <Text type="supporting" size="sm" hasTabularNumbers>
            최고 {w.max}° / 최저 {w.min}° · 비 {w.rain}%
          </Text>
        </VStack>
      </HStack>
      {air || advice ? (
        <VStack gap={1}>
          {air ? <Text type="supporting" size="sm">{air}</Text> : null}
          {advice ? (
            <Text color="accent" weight="medium">
              {advice}
            </Text>
          ) : null}
        </VStack>
      ) : null}
      {failed ? (
        <Text type="supporting" size="xsm">
          최신 날씨를 불러오지 못해 마지막으로 받은 날씨를 보여주고 있어요.
        </Text>
      ) : null}
    </Panel>
  );
}
