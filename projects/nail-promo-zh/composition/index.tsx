import React from 'react';
import {Composition, Still, registerRoot} from 'remotion';
import {NailPromo, Cover, TOTAL_FRAMES, PromoProps} from './NailPromo';

const defaults: PromoProps = {variant: 'A', texts: null};

const Root: React.FC = () => (
  <>
    <Composition
      id="NailPromo"
      component={NailPromo as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaults as unknown as Record<string, unknown>}
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
