/**
 * Avatar model registry.
 *
 * Phase 2 ships procedural humanoids only (no third-party assets needed).
 * Each entry describes body proportions; the Avatar component builds the
 * mesh rig from these numbers. A future `kind: 'gltf'` entry can point at a
 * licensed GLB with Idle/Walk/Run clips and be selected the same way.
 */
export type AvatarModelId = 'athlete' | 'slim'
export type TopStyle = 'jersey' | 'longsleeve' | 'training' | 'cardigan'

export interface ProceduralModel {
  kind: 'procedural'
  label: string
  /** half distance between shoulder joints */
  shoulder: number
  chestRadius: number
  chestDepth: number
  waistRadius: number
  hipWidth: number
  thigh: number
  shin: number
  upperArm: number
  forearm: number
  limbScale: number
  headRadius: number
}

export const AVATAR_MODELS: Record<AvatarModelId, ProceduralModel> = {
  athlete: {
    kind: 'procedural', label: '애슬릿 (기본)',
    shoulder: 0.205, chestRadius: 0.165, chestDepth: 0.62, waistRadius: 0.135, hipWidth: 0.095,
    thigh: 0.45, shin: 0.43, upperArm: 0.29, forearm: 0.26, limbScale: 1, headRadius: 0.112,
  },
  slim: {
    kind: 'procedural', label: '슬림',
    shoulder: 0.18, chestRadius: 0.145, chestDepth: 0.6, waistRadius: 0.118, hipWidth: 0.088,
    thigh: 0.47, shin: 0.45, upperArm: 0.29, forearm: 0.26, limbScale: 0.88, headRadius: 0.108,
  },
}

export const TOP_STYLES: Record<TopStyle, string> = {
  jersey: '반팔 유니폼',
  longsleeve: '긴팔 유니폼',
  training: '트레이닝 탑',
  cardigan: '핑크 가디건',
}

export const FOOT_HEIGHT = 0.075
