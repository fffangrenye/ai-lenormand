function Blossom({ x, y, rotate = 0, size = 1 }: { x: number; y: number; rotate?: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size})`}>
    {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-9" rx="7.5" ry="12" transform={`rotate(${angle})`} fill="#FFFDF8" fillOpacity=".9" stroke="currentColor" strokeWidth=".7" />)}
    <circle r="4.5" fill="#B9A486" fillOpacity=".25" stroke="currentColor" strokeWidth=".6" /><circle r="1.4" fill="currentColor" opacity=".55" />
  </g>;
}

export function HomeEntryArt({ kind }: { kind: "daily" | "choice" | "deep" }) {
  return <svg viewBox="0 0 160 160" fill="none" aria-hidden="true" className="h-full w-full">
    <circle cx="80" cy="78" r="57" stroke="currentColor" strokeOpacity=".12" strokeWidth=".6" />
    <g stroke="currentColor" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" opacity=".75">
      {kind === "daily" ? <><path d="M63 33h39M63 119h39M67 37c0 23 3 27 15 39-12 12-15 17-15 39m31-78c0 23-3 27-15 39 12 12 15 17 15 39" /><path d="M69 105q13-12 27 0v10H69Z" fill="currentColor" fillOpacity=".08" /><path d="M73 47h19L82 66Z" fill="currentColor" fillOpacity=".1" /><path d="M82 83v13" strokeDasharray="1 4" /></> : kind === "choice" ? <><path d="M83 25v47m0-24 20 24v15M69 84l14-12 14 12-14 38Z" /><path d="m69 84 28 0m-14-12-5 12 5 38 5-38-5-12m0 50v10" /><circle cx="103" cy="91" r="3" /><path d="m103 97 2 6 5 1-5 2-2 6-2-6-5-2 5-1Z" /></> : <><ellipse cx="83" cy="69" rx="26" ry="39" /><ellipse cx="83" cy="69" rx="22" ry="35" strokeOpacity=".45" /><path d="M79 108v21q4 7 8 0v-21" /><path d="M86 49a15 15 0 1 0 9 25 18 18 0 0 1-9-25Z" fill="currentColor" fillOpacity=".1" /><path d="M75 85h5m-2.5-2.5v5M95 45h4m-2-2v4" /></>}
      <path d="M42 119q17-37 12-74M52 78q-22 2-23-16 16 0 23 16Zm3-22q15-3 15-18-13 3-15 18ZM108 134q-6-27 12-49m-7 31q20 1 21-14-14-1-21 14Zm-3 8q-14-1-18-14 15-2 18 14Z" fill="currentColor" fillOpacity=".08" />
    </g><g opacity=".9"><Blossom x={49} y={89} rotate={-18} size={.84} /><Blossom x={116} y={112} rotate={20} size={.62} /></g>
  </svg>;
}
