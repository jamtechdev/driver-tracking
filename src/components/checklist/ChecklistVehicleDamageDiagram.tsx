/**
 * Tap-to-mark vehicle damage on bundled or remote diagram (Peak checklist image item — not camera upload).
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  type ImageSourcePropType,
} from 'react-native';
import { COLORS } from '@/theme/colors';
import {
  parseChecklistDamageMarks,
  stringifyChecklistDamageMarks,
  layoutPointToIntrinsicPixel,
  intrinsicPixelToLayoutPoint,
} from '@/utils/checklistDamageMarks';

/** Metro resolves static `require()` paths reliably; alias is TS-only at compile time. */
const DEFAULT_BUS_IMAGE = require('../../assets/bus1.jpg');

function resolveDiagramSource(itemUnit?: string): { source: ImageSourcePropType; isRemote: boolean } {
  const u = String(itemUnit ?? '').trim();
  if (/^https?:\/\//i.test(u)) {
    return { source: { uri: u }, isRemote: true };
  }
  const lower = u.toLowerCase();
  if (!lower || lower === 'bus1.jpg' || lower.endsWith('/bus1.jpg') || lower === 'bus1') {
    return { source: DEFAULT_BUS_IMAGE, isRemote: false };
  }
  /** Unknown filename → bundled default (matches legacy when itemUnit empty). */
  return { source: DEFAULT_BUS_IMAGE, isRemote: false };
}

const DIAGRAM_MAX_H = 280;

export interface ChecklistVehicleDamageDiagramProps {
  itemUnit?: string;
  value: string;
  onChangeValue: (serialized: string) => void;
}

const ChecklistVehicleDamageDiagram: React.FC<ChecklistVehicleDamageDiagramProps> = ({
  itemUnit,
  value,
  onChangeValue,
}) => {
  const { source, isRemote } = useMemo(() => resolveDiagramSource(itemUnit), [itemUnit]);

  const [layoutW, setLayoutW] = useState(0);
  const [layoutH, setLayoutH] = useState(0);
  const [intrinsicW, setIntrinsicW] = useState(1);
  const [intrinsicH, setIntrinsicH] = useState(1);

  useEffect(() => {
    if (isRemote) return;
    const resolved = Image.resolveAssetSource(source as ImageSourcePropType);
    const w = resolved?.width;
    const h = resolved?.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      setIntrinsicW(w);
      setIntrinsicH(h);
    }
  }, [source, isRemote]);

  const marks = useMemo(() => parseChecklistDamageMarks(value), [value]);

  const onImageLoad = useCallback(
    (e: { nativeEvent: { source: { width: number; height: number } } }) => {
      const w = e.nativeEvent?.source?.width;
      const h = e.nativeEvent?.source?.height;
      if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
        setIntrinsicW(w);
        setIntrinsicH(h);
      }
    },
    [],
  );

  const onLayoutBox = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutW(width);
    setLayoutH(height);
  }, []);

  const onPressDiagram = useCallback(
    (ev: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (layoutW <= 0 || layoutH <= 0) return;
      const { locationX, locationY } = ev.nativeEvent;
      const p = layoutPointToIntrinsicPixel(
        locationX,
        locationY,
        layoutW,
        layoutH,
        intrinsicW,
        intrinsicH,
      );
      if (!p) return;
      const next = [...marks, p];
      onChangeValue(stringifyChecklistDamageMarks(next));
    },
    [layoutW, layoutH, intrinsicW, intrinsicH, marks, onChangeValue],
  );

  const clearMarks = useCallback(() => {
    onChangeValue('');
  }, [onChangeValue]);

  const undoLast = useCallback(() => {
    if (marks.length === 0) return;
    onChangeValue(stringifyChecklistDamageMarks(marks.slice(0, -1)));
  }, [marks, onChangeValue]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Tap the diagram to mark damage (red dots). Coordinates are saved in image pixel space for the server.
      </Text>
      <Pressable
        onPress={onPressDiagram}
        style={styles.diagramFrame}
        onLayout={onLayoutBox}
      >
        <Image
          source={source}
          style={styles.image}
          resizeMode="contain"
          onLoad={onImageLoad}
        />
        {layoutW > 0 &&
          layoutH > 0 &&
          marks.map((p, i) => {
            const pt = intrinsicPixelToLayoutPoint(
              p.x,
              p.y,
              layoutW,
              layoutH,
              intrinsicW,
              intrinsicH,
            );
            if (!pt) return null;
            const r = 8;
            return (
              <View
                key={`${p.x},${p.y}-${i}`}
                style={[
                  styles.dot,
                  {
                    left: pt.x - r,
                    top: pt.y - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                  },
                ]}
              />
            );
          })}
      </Pressable>
      <View style={styles.toolbar}>
        <Pressable onPress={undoLast} style={styles.toolBtn} disabled={marks.length === 0}>
          <Text style={[styles.toolBtnText, marks.length === 0 && styles.toolBtnTextDisabled]}>Undo last</Text>
        </Pressable>
        <Pressable onPress={clearMarks} style={styles.toolBtn} disabled={marks.length === 0}>
          <Text style={[styles.toolBtnText, marks.length === 0 && styles.toolBtnTextDisabled]}>Clear all</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  hint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  diagramFrame: {
    width: '100%',
    height: DIAGRAM_MAX_H,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dot: {
    position: 'absolute',
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    borderWidth: 1,
    borderColor: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  toolBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toolBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  toolBtnTextDisabled: {
    color: COLORS.textMuted,
    opacity: 0.5,
  },
});

export default ChecklistVehicleDamageDiagram;
