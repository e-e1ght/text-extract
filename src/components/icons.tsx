/**
 * 레일과 상단 막대에 쓰는 아이콘.
 *
 * 직접 그리지 않고 Font Awesome 의 것을 가져다 씁니다. 손으로 그린 선 아이콘은
 * 굵기·여백이 제각각이라 나란히 두면 눈에 거슬립니다.
 *
 * 다만 아이콘 글꼴도, 공식 렌더러(@fortawesome/react-fontawesome)도 쓰지 않습니다.
 * 렌더러는 온갖 기능이 딸려 와 gzip 28KB 를 더하는데, 우리가 쓰는 건 열두 모양뿐입니다.
 * 모양 자료만 가져와(번들에서 쓰는 것만 남습니다) 여기서 직접 그립니다.
 */
import {
  faAlignLeft,
  faCommentDots,
  faCropSimple,
  faFloppyDisk,
  faHeading,
  faImage,
  faMoon,
  faPalette,
  faRotateLeft,
  faRotateRight,
  faSun,
  faXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

type IconProps = { size?: number };

function Glyph({ icon, size = 16 }: { icon: IconDefinition; size?: number }) {
  const [width, height, , , path] = icon.icon;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      height={size}
      width={(size * width) / height}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d={Array.isArray(path) ? path.join(' ') : path} />
    </svg>
  );
}

export const IconHeading = ({ size }: IconProps) => <Glyph icon={faHeading} size={size} />;
export const IconText = ({ size }: IconProps) => <Glyph icon={faAlignLeft} size={size} />;
export const IconPalette = ({ size }: IconProps) => <Glyph icon={faPalette} size={size} />;
export const IconBubble = ({ size }: IconProps) => <Glyph icon={faCommentDots} size={size} />;
export const IconImage = ({ size }: IconProps) => <Glyph icon={faImage} size={size} />;
export const IconFrame = ({ size }: IconProps) => <Glyph icon={faCropSimple} size={size} />;
export const IconSave = ({ size }: IconProps) => <Glyph icon={faFloppyDisk} size={size} />;
export const IconClose = ({ size }: IconProps) => <Glyph icon={faXmark} size={size} />;
export const IconUndo = ({ size }: IconProps) => <Glyph icon={faRotateLeft} size={size} />;
export const IconRedo = ({ size }: IconProps) => <Glyph icon={faRotateRight} size={size} />;
export const IconSun = ({ size }: IconProps) => <Glyph icon={faSun} size={size} />;
export const IconMoon = ({ size }: IconProps) => <Glyph icon={faMoon} size={size} />;
