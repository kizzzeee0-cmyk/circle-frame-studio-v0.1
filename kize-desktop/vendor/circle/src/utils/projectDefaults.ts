import type {
  BackgroundSettings,
  MediaAnimationSettings,
  MediaLayer,
  MediaLayerKind,
  TimelineSettings,
  ComposerSettings,
} from '../types'
import { uid } from './id'

export function defaultTimeline(): TimelineSettings {
  return { duration: 3, loop: true }
}

export function defaultComposerSettings(): ComposerSettings {
  return {
    snapEnabled: true,
    snapSize: 10,
    showGuides: true,
    showCenterGuides: true,
    timelineSnapEnabled: true,
    timelineFps: 30,
    performanceMode: 'auto',
    previewResolution: 1200,
  }
}

export function defaultBackground(): BackgroundSettings {
  return {
    type: 'transparent',
    color: '#FFF2BD',
    assetId: '',
    sourceUrl: '',
    fileName: '',
    mimeType: '',
    opacity: 1,
    fit: 'cover',
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  }
}

export function defaultMediaAnimation(): MediaAnimationSettings {
  return {
    intro: 'none',
    introStart: 0,
    introDuration: .45,
    outro: 'none',
    outroStart: 2.5,
    outroDuration: .45,
    continuous: 'none',
    speed: 1,
    strength: 1,
    ease: 'ease-out',
    moveDistance: 260,
    rotateAngle: 180,
    scaleAmount: .35,
    bounceStrength: 1,
  }
}

export function createMediaLayer(
  kind: MediaLayerKind,
  assetId: string,
  sourceUrl: string,
  fileName: string,
  mimeType: string,
  projectDuration = 3,
): MediaLayer {
  return {
    id: uid('media'),
    name: fileName || (kind === 'video' ? '영상 레이어' : '이미지 레이어'),
    kind,
    assetId,
    sourceUrl,
    fileName,
    mimeType,
    visible: true,
    locked: false,
    placement: 'below',
    x: 0,
    y: 0,
    width: 1450,
    height: 1450,
    scale: 1,
    rotation: 0,
    opacity: 1,
    blendMode: 'normal',
    fit: 'cover',
    maskMode: 'circle',
    maskRadius: 700,
    maskX: 0,
    maskY: 0,
    ringThickness: 120,
    maskFrameLayerId: '',
    customMaskAssetId: '',
    customMaskSourceUrl: '',
    customMaskFileName: '',
    customMaskInvert: false,
    customMaskFit: 'cover',
    customMaskScale: 1,
    customMaskRotation: 0,
    customMaskX: 0,
    customMaskY: 0,
    maskSyncRotation: true,
    keepFrameAbove: true,
    startTime: 0,
    endTime: Math.max(.1, projectDuration),
    trimStart: 0,
    trimEnd: 0,
    followFrameRotation: false,
    followFrameLayerId: '',
    audioEnabled: true,
    audioVolume: 1,
    groupId: '',
    animation: {
      ...defaultMediaAnimation(),
      outroStart: Math.max(0, projectDuration - .45),
    },
  }
}

export function normalizeMediaLayer(source: Partial<MediaLayer>, index: number, projectDuration: number): MediaLayer {
  const base = createMediaLayer(
    source.kind === 'video' ? 'video' : 'image',
    source.assetId ?? '',
    source.sourceUrl ?? '',
    source.fileName ?? '',
    source.mimeType ?? '',
    projectDuration,
  )
  return {
    ...base,
    ...source,
    id: source.id || uid('media'),
    name: source.name || source.fileName || ('미디어 ' + (index + 1)),
    width: Math.max(1, Number(source.width ?? base.width)),
    height: Math.max(1, Number(source.height ?? base.height)),
    scale: Math.max(.02, Number(source.scale ?? base.scale)),
    opacity: Math.max(0, Math.min(1, Number(source.opacity ?? base.opacity))),
    blendMode: ['normal','multiply','screen','overlay','soft-light'].includes(String(source.blendMode)) ? source.blendMode! : 'normal',
    maskRadius: Math.max(1, Number(source.maskRadius ?? base.maskRadius)),
    ringThickness: Math.max(1, Number(source.ringThickness ?? base.ringThickness)),
    startTime: Math.max(0, Number(source.startTime ?? 0)),
    endTime: Math.max(.01, Number(source.endTime ?? projectDuration)),
    trimStart: Math.max(0, Number(source.trimStart ?? 0)),
    trimEnd: Math.max(0, Number(source.trimEnd ?? 0)),
    followFrameRotation: source.followFrameRotation === true,
    followFrameLayerId: source.followFrameLayerId ?? '',
    customMaskScale: Math.max(.02, Number(source.customMaskScale ?? base.customMaskScale)),
    customMaskRotation: Number(source.customMaskRotation ?? 0),
    customMaskX: Number(source.customMaskX ?? 0),
    customMaskY: Number(source.customMaskY ?? 0),
    audioEnabled: source.audioEnabled !== false,
    audioVolume: Math.max(0, Math.min(2, Number(source.audioVolume ?? 1))),
    groupId: source.groupId ?? '',
    animation: {
      ...base.animation,
      ...(source.animation ?? {}),
    },
  }
}

export function normalizeBackground(source?: Partial<BackgroundSettings>): BackgroundSettings {
  return {
    ...defaultBackground(),
    ...(source ?? {}),
    opacity: Math.max(0, Math.min(1, Number(source?.opacity ?? 1))),
  }
}

export function normalizeTimeline(source?: Partial<TimelineSettings>): TimelineSettings {
  return {
    duration: Math.max(.5, Math.min(60, Number(source?.duration ?? 3))),
    loop: source?.loop !== false,
  }
}


export function normalizeComposerSettings(source?: Partial<ComposerSettings>): ComposerSettings {
  const base = defaultComposerSettings()
  return {
    ...base,
    ...(source ?? {}),
    snapEnabled: source?.snapEnabled !== false,
    snapSize: Math.max(1, Math.min(100, Number(source?.snapSize ?? base.snapSize))),
    showGuides: source?.showGuides !== false,
    showCenterGuides: source?.showCenterGuides !== false,
    timelineSnapEnabled: source?.timelineSnapEnabled !== false,
    timelineFps: [12,15,20,24,30,60].includes(Number(source?.timelineFps)) ? source!.timelineFps! : 30,
    performanceMode: ['auto','quality','performance'].includes(String(source?.performanceMode)) ? source!.performanceMode! : 'auto',
    previewResolution: [720,960,1200].includes(Number(source?.previewResolution)) ? source!.previewResolution! : 1200,
  }
}
