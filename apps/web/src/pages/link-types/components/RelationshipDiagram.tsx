import { theme } from 'antd';

export type DiagramType =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many'
  | 'many-to-many-bo';

interface RelationshipDiagramProps {
  type: DiagramType;
  active?: boolean;
  width?: number;
  height?: number;
}

export default function RelationshipDiagram({
  type,
  active = false,
  width = 140,
  height = 56,
}: RelationshipDiagramProps) {
  const { token } = theme.useToken();
  const stroke = active ? token.colorPrimary : token.colorTextQuaternary;
  const fill = active ? token.colorPrimary : token.colorTextQuaternary;
  const activeFill = active ? token.colorPrimaryBg : 'none';

  const dotR = 4.5;
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontFamily: token.fontFamily,
    fill: active ? token.colorPrimary : token.colorTextTertiary,
    fontWeight: 500,
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {type === 'one-to-one' && (
        <>
          {/* A label */}
          <text x="22" y="10" textAnchor="middle" style={labelStyle}>
            A
          </text>
          {/* B label */}
          <text x="118" y="10" textAnchor="middle" style={labelStyle}>
            B
          </text>
          {/* Left dot */}
          <circle cx="22" cy="28" r={dotR + 1} fill={activeFill} stroke={stroke} strokeWidth={1.8} />
          <circle cx="22" cy="28" r={2} fill={fill} />
          {/* Line */}
          <line x1="30" y1="28" x2="110" y2="28" stroke={stroke} strokeWidth={1.5} strokeDasharray="none" />
          {/* Right dot */}
          <circle cx="118" cy="28" r={dotR + 1} fill={activeFill} stroke={stroke} strokeWidth={1.8} />
          <circle cx="118" cy="28" r={2} fill={fill} />
          {/* 1 / 1 labels */}
          <text x="22" y="48" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            1
          </text>
          <text x="118" y="48" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            1
          </text>
        </>
      )}

      {type === 'one-to-many' && (
        <>
          <text x="22" y="10" textAnchor="middle" style={labelStyle}>
            A
          </text>
          <text x="118" y="10" textAnchor="middle" style={labelStyle}>
            B
          </text>
          {/* Left single dot */}
          <circle cx="22" cy="28" r={dotR + 1} fill={activeFill} stroke={stroke} strokeWidth={1.8} />
          <circle cx="22" cy="28" r={2} fill={fill} />
          {/* Lines fanning out */}
          <line x1="30" y1="28" x2="110" y2="16" stroke={stroke} strokeWidth={1.2} />
          <line x1="30" y1="28" x2="110" y2="28" stroke={stroke} strokeWidth={1.2} />
          <line x1="30" y1="28" x2="110" y2="40" stroke={stroke} strokeWidth={1.2} />
          {/* Right three dots */}
          <circle cx="118" cy="16" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="118" cy="16" r={1.5} fill={fill} />
          <circle cx="118" cy="28" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="118" cy="28" r={1.5} fill={fill} />
          <circle cx="118" cy="40" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="118" cy="40" r={1.5} fill={fill} />
          {/* Cardinality labels */}
          <text x="22" y="48" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            1
          </text>
          <text x="118" y="54" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            N
          </text>
        </>
      )}

      {type === 'many-to-one' && (
        <>
          <text x="22" y="10" textAnchor="middle" style={labelStyle}>
            A
          </text>
          <text x="118" y="10" textAnchor="middle" style={labelStyle}>
            B
          </text>
          {/* Left three dots */}
          <circle cx="22" cy="16" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="22" cy="16" r={1.5} fill={fill} />
          <circle cx="22" cy="28" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="22" cy="28" r={1.5} fill={fill} />
          <circle cx="22" cy="40" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="22" cy="40" r={1.5} fill={fill} />
          {/* Lines converging */}
          <line x1="30" y1="16" x2="110" y2="28" stroke={stroke} strokeWidth={1.2} />
          <line x1="30" y1="28" x2="110" y2="28" stroke={stroke} strokeWidth={1.2} />
          <line x1="30" y1="40" x2="110" y2="28" stroke={stroke} strokeWidth={1.2} />
          {/* Right single dot */}
          <circle cx="118" cy="28" r={dotR + 1} fill={activeFill} stroke={stroke} strokeWidth={1.8} />
          <circle cx="118" cy="28" r={2} fill={fill} />
          {/* Cardinality labels */}
          <text x="22" y="54" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            N
          </text>
          <text x="118" y="48" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            1
          </text>
        </>
      )}

      {type === 'many-to-many' && (
        <>
          <text x="22" y="10" textAnchor="middle" style={labelStyle}>
            A
          </text>
          <text x="118" y="10" textAnchor="middle" style={labelStyle}>
            B
          </text>
          {/* Left three dots */}
          <circle cx="22" cy="16" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="22" cy="16" r={1.5} fill={fill} />
          <circle cx="22" cy="28" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="22" cy="28" r={1.5} fill={fill} />
          <circle cx="22" cy="40" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="22" cy="40" r={1.5} fill={fill} />
          {/* Cross-connecting lines */}
          <line x1="30" y1="16" x2="110" y2="16" stroke={stroke} strokeWidth={1} opacity={0.6} />
          <line x1="30" y1="16" x2="110" y2="28" stroke={stroke} strokeWidth={1} opacity={0.4} />
          <line x1="30" y1="28" x2="110" y2="16" stroke={stroke} strokeWidth={1} opacity={0.4} />
          <line x1="30" y1="28" x2="110" y2="28" stroke={stroke} strokeWidth={1} opacity={0.6} />
          <line x1="30" y1="28" x2="110" y2="40" stroke={stroke} strokeWidth={1} opacity={0.4} />
          <line x1="30" y1="40" x2="110" y2="28" stroke={stroke} strokeWidth={1} opacity={0.4} />
          <line x1="30" y1="40" x2="110" y2="40" stroke={stroke} strokeWidth={1} opacity={0.6} />
          {/* Right three dots */}
          <circle cx="118" cy="16" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="118" cy="16" r={1.5} fill={fill} />
          <circle cx="118" cy="28" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="118" cy="28" r={1.5} fill={fill} />
          <circle cx="118" cy="40" r={dotR} fill={activeFill} stroke={stroke} strokeWidth={1.5} />
          <circle cx="118" cy="40" r={1.5} fill={fill} />
          {/* Cardinality labels */}
          <text x="22" y="54" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            N
          </text>
          <text x="118" y="54" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            N
          </text>
        </>
      )}

      {type === 'many-to-many-bo' && (
        <>
          <text x="18" y="10" textAnchor="middle" style={labelStyle}>
            A
          </text>
          <text x="122" y="10" textAnchor="middle" style={labelStyle}>
            B
          </text>
          {/* Left dots */}
          <circle cx="18" cy="16" r={3.5} fill={activeFill} stroke={stroke} strokeWidth={1.3} />
          <circle cx="18" cy="16" r={1.2} fill={fill} />
          <circle cx="18" cy="28" r={3.5} fill={activeFill} stroke={stroke} strokeWidth={1.3} />
          <circle cx="18" cy="28" r={1.2} fill={fill} />
          <circle cx="18" cy="40" r={3.5} fill={activeFill} stroke={stroke} strokeWidth={1.3} />
          <circle cx="18" cy="40" r={1.2} fill={fill} />
          {/* Lines to center diamond */}
          <line x1="24" y1="16" x2="58" y2="28" stroke={stroke} strokeWidth={1.2} />
          <line x1="24" y1="28" x2="58" y2="28" stroke={stroke} strokeWidth={1.2} />
          <line x1="24" y1="40" x2="58" y2="28" stroke={stroke} strokeWidth={1.2} />
          {/* Center diamond (mediator object) */}
          <path
            d="M70 16 L82 28 L70 40 L58 28 Z"
            fill={active ? token.colorPrimaryBgHover : token.colorFillQuaternary}
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <text x="70" y="32" textAnchor="middle" style={{ ...labelStyle, fontSize: 8 }}>
            OT
          </text>
          {/* Lines from diamond to right */}
          <line x1="82" y1="28" x2="116" y2="16" stroke={stroke} strokeWidth={1.2} />
          <line x1="82" y1="28" x2="116" y2="28" stroke={stroke} strokeWidth={1.2} />
          <line x1="82" y1="28" x2="116" y2="40" stroke={stroke} strokeWidth={1.2} />
          {/* Right dots */}
          <circle cx="122" cy="16" r={3.5} fill={activeFill} stroke={stroke} strokeWidth={1.3} />
          <circle cx="122" cy="16" r={1.2} fill={fill} />
          <circle cx="122" cy="28" r={3.5} fill={activeFill} stroke={stroke} strokeWidth={1.3} />
          <circle cx="122" cy="28" r={1.2} fill={fill} />
          <circle cx="122" cy="40" r={3.5} fill={activeFill} stroke={stroke} strokeWidth={1.3} />
          <circle cx="122" cy="40" r={1.2} fill={fill} />
          {/* Labels */}
          <text x="18" y="54" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            N
          </text>
          <text x="122" y="54" textAnchor="middle" style={{ ...labelStyle, fontSize: 10, fontWeight: 600 }}>
            N
          </text>
        </>
      )}
    </svg>
  );
}
