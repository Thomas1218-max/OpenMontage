import React from 'react';
import {Composition, Still, registerRoot} from 'remotion';
import {NailPromo, Cover, DEFAULT_T, PromoProps} from './NailPromo';

const defaults: PromoProps = {variant: 'A', texts: null};

const Root: React.FC = () => (
  <>
    <Composition
      id="NailPromo"
      component={NailPromo as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={DEFAULT_T.END}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaults as unknown as Record<string, unknown>}
      // Length comes from promo.json timeline.END (passed in props).
      calculateMetadata={({props}) => {
        const p = props as unknown as PromoProps;
        return {durationInFrames: p.timeline?.END ?? DEFAULT_T.END};
      }}
    />
    <Still
      id="Cover"
      component={Cover as unknown as React.FC<Record<string, unknown>>}
      width={1080}
      height={1920}
      defaultProps={defaults as unknown as Record<string, unknown>}
    />
  </>
);

registerRoot(Root);
