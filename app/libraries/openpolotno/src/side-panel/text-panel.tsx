// @ts-nocheck
'use client';
import React from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Tab, Tabs } from '@blueprintjs/core';
import { Upload, Trash } from '@blueprintjs/icons';
import { t as s } from '../utils/l10n';
import styled from '../utils/styled';
import { isMobile } from '../utils/screen';
import { localFileToURL } from '../utils/file';
import { registerNextDomDrop } from '../canvas/page';
import { StoreType } from '../model/store';
import { getFontsList } from '../utils/fonts';

// ─── Local text composition templates ────────────────────────────────────────
// Each entry defines the visual preview (rendered in DOM so fonts load from
// Google Fonts automatically) and the polotno elements to drop on the canvas.

interface TemplateLayer {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string;
  align?: string;
  // fractional offsets within the preview card (0–1)
  _px: number; // x as fraction of canvas width
  _py: number; // y as fraction of canvas height
  _pw: number; // width fraction
}

interface StyleTemplate {
  id: string;
  bg: string;
  layers: TemplateLayer[];
}

const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 'bold-sale',
    bg: '#0a0a0a',
    layers: [
      { text: 'END OF SEASON', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 'bold', fill: '#ffffff', align: 'center', _px: 0.05, _py: 0.08, _pw: 0.9 },
      { text: 'SALE', fontFamily: 'Bebas Neue', fontSize: 44, fontWeight: 'bold', fill: '#ffffff', align: 'center', _px: 0.05, _py: 0.28, _pw: 0.9 },
      { text: 'UP TO 70% OFF', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: '600', fill: '#aaaaaa', align: 'center', _px: 0.05, _py: 0.82, _pw: 0.9 },
    ],
  },
  {
    id: 'script-adventure',
    bg: '#f5f0e8',
    layers: [
      { text: 'Life is an', fontFamily: 'Raleway', fontSize: 12, fontWeight: '300', fill: '#333333', align: 'center', _px: 0.05, _py: 0.1, _pw: 0.9 },
      { text: 'Adventure', fontFamily: 'Pacifico', fontSize: 28, fill: '#1a1a1a', align: 'center', _px: 0.05, _py: 0.3, _pw: 0.9 },
    ],
  },
  {
    id: 'congratulations',
    bg: '#ffffff',
    layers: [
      { text: 'Congratulations!', fontFamily: 'Dancing Script', fontSize: 26, fontWeight: 'bold', fill: '#c0392b', align: 'center', _px: 0.05, _py: 0.2, _pw: 0.9 },
      { text: "You're a Big Brother", fontFamily: 'Lato', fontSize: 12, fill: '#444444', align: 'center', _px: 0.05, _py: 0.65, _pw: 0.9 },
    ],
  },
  {
    id: 'marketing-proposal',
    bg: '#ffffff',
    layers: [
      { text: 'MJMK AND CO', fontFamily: 'Barlow', fontSize: 9, fontWeight: '600', fill: '#888888', align: 'left', _px: 0.08, _py: 0.08, _pw: 0.84 },
      { text: 'MARKETING\nPROPOSAL', fontFamily: 'Oswald', fontSize: 22, fontWeight: 'bold', fill: '#111111', align: 'left', _px: 0.08, _py: 0.22, _pw: 0.84 },
      { text: 'An operational document that outlines the advertising strategy for your organisation.', fontFamily: 'Source Sans 3', fontSize: 7, fill: '#555555', align: 'left', _px: 0.08, _py: 0.68, _pw: 0.84 },
    ],
  },
  {
    id: 'job-posting',
    bg: '#1a2744',
    layers: [
      { text: 'LOOKING FOR', fontFamily: 'Barlow', fontSize: 9, fontWeight: '300', fill: '#aabbdd', align: 'center', _px: 0.05, _py: 0.08, _pw: 0.9 },
      { text: 'OPERATIONS\nMANAGER', fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 'bold', fill: '#ffffff', align: 'center', _px: 0.05, _py: 0.28, _pw: 0.9 },
      { text: 'Join our growing team', fontFamily: 'Barlow', fontSize: 8, fill: '#8899bb', align: 'center', _px: 0.05, _py: 0.78, _pw: 0.9 },
    ],
  },
  {
    id: 'minimalist',
    bg: '#f8f8f8',
    layers: [
      { text: 'The Future Of Design', fontFamily: 'Raleway', fontSize: 10, fontWeight: '300', fill: '#999999', align: 'center', _px: 0.05, _py: 0.15, _pw: 0.9 },
      { text: 'MINIMALISM', fontFamily: 'Montserrat', fontSize: 20, fontWeight: '800', fill: '#111111', align: 'center', _px: 0.05, _py: 0.42, _pw: 0.9 },
    ],
  },
  {
    id: 'invitation',
    bg: '#fafaf7',
    layers: [
      { text: "You're\nInvited", fontFamily: 'Cormorant Garamond', fontSize: 28, fontStyle: 'italic', fill: '#2c2c2c', align: 'left', _px: 0.08, _py: 0.15, _pw: 0.55 },
      { text: 'Saturday\nJune 14, 2025\n6:00 pm – 9:00 pm', fontFamily: 'Raleway', fontSize: 7, fontWeight: '300', fill: '#777777', align: 'left', _px: 0.08, _py: 0.72, _pw: 0.84 },
    ],
  },
  {
    id: 'price-list',
    bg: '#ffffff',
    layers: [
      { text: 'PRICE LIST:', fontFamily: 'Oswald', fontSize: 14, fontWeight: 'bold', fill: '#111111', align: 'left', _px: 0.08, _py: 0.08, _pw: 0.84 },
      { text: 'Basic Package', fontFamily: 'Source Sans 3', fontSize: 9, fill: '#333333', align: 'left', _px: 0.08, _py: 0.32, _pw: 0.6 },
      { text: '$49', fontFamily: 'Oswald', fontSize: 9, fontWeight: 'bold', fill: '#111111', align: 'right', _px: 0.08, _py: 0.32, _pw: 0.84 },
      { text: 'Pro Package', fontFamily: 'Source Sans 3', fontSize: 9, fill: '#333333', align: 'left', _px: 0.08, _py: 0.50, _pw: 0.6 },
      { text: '$99', fontFamily: 'Oswald', fontSize: 9, fontWeight: 'bold', fill: '#111111', align: 'right', _px: 0.08, _py: 0.50, _pw: 0.84 },
    ],
  },
  {
    id: 'quote-dark',
    bg: '#1c1c1c',
    layers: [
      { text: '"The Best Way To\nGet Started Is To\nQuit Talking And\nBegin Doing."', fontFamily: 'Lora', fontSize: 11, fontStyle: 'italic', fill: '#ffffff', align: 'left', _px: 0.08, _py: 0.1, _pw: 0.84 },
      { text: '— Walt Disney', fontFamily: 'Lato', fontSize: 9, fontWeight: 'bold', fill: '#aaaaaa', align: 'left', _px: 0.08, _py: 0.82, _pw: 0.84 },
    ],
  },
  {
    id: 'quote-light',
    bg: '#f5f5f5',
    layers: [
      { text: '"The Pessimist Sees\nDifficulty In Every\nOpportunity."', fontFamily: 'Playfair Display', fontSize: 10, fontStyle: 'italic', fill: '#333333', align: 'center', _px: 0.05, _py: 0.12, _pw: 0.9 },
      { text: '— Winston Churchill', fontFamily: 'Source Sans 3', fontSize: 8, fill: '#777777', align: 'center', _px: 0.05, _py: 0.82, _pw: 0.9 },
    ],
  },
  {
    id: 'script-memories',
    bg: '#fdfaf5',
    layers: [
      { text: 'These Great Memories', fontFamily: 'Raleway', fontSize: 8, fontWeight: '300', fill: '#999999', align: 'center', _px: 0.05, _py: 0.1, _pw: 0.9 },
      { text: 'Last Forever', fontFamily: 'Great Vibes', fontSize: 30, fill: '#3a3a3a', align: 'center', _px: 0.05, _py: 0.35, _pw: 0.9 },
    ],
  },
  {
    id: 'discount',
    bg: '#111111',
    layers: [
      { text: 'EVERYTHING MUST GO', fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: '600', fill: '#ffffff', align: 'center', _px: 0.05, _py: 0.08, _pw: 0.9 },
      { text: 'FLAT', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: '300', fill: '#cccccc', align: 'left', _px: 0.08, _py: 0.38, _pw: 0.3 },
      { text: '50%', fontFamily: 'Bebas Neue', fontSize: 44, fill: '#ffffff', align: 'left', _px: 0.28, _py: 0.25, _pw: 0.65 },
      { text: 'OFF — TODAY ONLY', fontFamily: 'Barlow Condensed', fontSize: 9, fill: '#888888', align: 'center', _px: 0.05, _py: 0.85, _pw: 0.9 },
    ],
  },
  {
    id: 'boss-babe',
    bg: '#ffffff',
    layers: [
      { text: "Don't Mess With A", fontFamily: 'Barlow', fontSize: 9, fontWeight: '300', fill: '#333333', align: 'center', _px: 0.05, _py: 0.08, _pw: 0.9 },
      { text: 'Boss Babe', fontFamily: 'Playfair Display', fontSize: 26, fontWeight: 'bold', fill: '#111111', align: 'center', _px: 0.05, _py: 0.28, _pw: 0.9 },
      { text: 'ONE BRAND BUSINESS YOU BETTER TRUST AND RESPECT', fontFamily: 'Barlow Condensed', fontSize: 7, fontWeight: '600', fill: '#888888', align: 'center', _px: 0.05, _py: 0.76, _pw: 0.9 },
    ],
  },
  {
    id: 'ancient-gold',
    bg: '#1a1508',
    layers: [
      { text: 'Ancient', fontFamily: 'Cinzel', fontSize: 28, fill: '#c9a84c', align: 'center', _px: 0.05, _py: 0.32, _pw: 0.9 },
      { text: '— WISDOM —', fontFamily: 'Cormorant Garamond', fontSize: 9, fontWeight: '300', fill: '#8a7340', align: 'center', _px: 0.05, _py: 0.72, _pw: 0.9 },
    ],
  },
  {
    id: 'awesome-pink',
    bg: '#ffffff',
    layers: [
      { text: 'Awesome!', fontFamily: 'Pacifico', fontSize: 30, fill: '#e91e8c', align: 'center', _px: 0.05, _py: 0.28, _pw: 0.9 },
      { text: 'YOU ARE', fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: '600', fill: '#cccccc', align: 'center', _px: 0.05, _py: 0.08, _pw: 0.9 },
    ],
  },
  {
    id: 'beautiful-script',
    bg: '#fdf8f0',
    layers: [
      { text: 'Beautiful', fontFamily: 'Cormorant Garamond', fontSize: 28, fontStyle: 'italic', fill: '#c8922a', align: 'center', _px: 0.05, _py: 0.28, _pw: 0.9 },
      { text: 'simply beautiful', fontFamily: 'Raleway', fontSize: 8, fontWeight: '300', fill: '#aaaaaa', align: 'center', _px: 0.05, _py: 0.75, _pw: 0.9 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────

const TextPanelContent = styled('div')`
  height: calc(100% - 40px);
  display: flex;
  flex-direction: column;

  .bp5-dark & .raeditor-text-preview-plain {
    filter: invert(1);
  }
`;

const FontPreviewBox = styled('div')`
  height: 100px;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(16, 22, 26, 0.3);
  border-radius: 5px;
  background-color: rgba(0, 0, 0, 0.4);
  position: relative;
  font-size: 25px;
  display: flex;
  justify-content: center;
  align-content: center;
  flex-direction: column;
  text-align: center;
  color: white;
  margin-bottom: 10px;
`;

let fontUploadFunc: (file: File) => Promise<string> = async (f) => localFileToURL(f);
export function setFontUploadFunc(func: any) { fontUploadFunc = func; }

const FontItem = observer(({ onSelect, onRemove, font }: any) =>
  React.createElement(
    FontPreviewBox,
    { style: { fontFamily: font.fontFamily }, className: 'raeditor-font-item', onClick: onSelect },
    font.fontFamily, ' text',
    React.createElement(Button, {
      style: { position: 'absolute', right: 0, bottom: 0 },
      minimal: true,
      icon: React.createElement(Trash, null),
      onClick: (e: any) => { e.stopPropagation(); onRemove(); },
    })
  )
);

const DraggableButton = ({ onSelect, ...rest }: any) =>
  React.createElement(Button, {
    ...rest,
    draggable: true,
    className: 'raeditor-close-panel',
    onClick: () => onSelect(),
    onDragStart: () => { registerNextDomDrop(({ x, y }: any) => { onSelect({ x, y }); }); },
    onDragEnd: () => { registerNextDomDrop(null); },
  });

// Renders a single template card entirely in the DOM — fonts load from Google
// Fonts automatically because we set fontFamily on the DOM nodes.
const TemplateCard = ({ tpl, onClick }: { tpl: StyleTemplate; onClick: () => void }) =>
  React.createElement(
    'div',
    {
      onClick,
      style: {
        position: 'relative',
        height: '130px',
        background: tpl.bg,
        borderRadius: '5px',
        boxShadow: '0 0 5px rgba(16,22,26,0.3)',
        cursor: 'pointer',
        overflow: 'hidden',
        marginBottom: 0,
      },
    },
    tpl.layers.map((layer, i) =>
      React.createElement('div', {
        key: i,
        style: {
          position: 'absolute',
          left: `${layer._px * 100}%`,
          top: `${layer._py * 100}%`,
          width: `${layer._pw * 100}%`,
          fontFamily: `"${layer.fontFamily}"`,
          fontSize: `${layer.fontSize}px`,
          fontWeight: layer.fontWeight ?? 'normal',
          fontStyle: layer.fontStyle ?? 'normal',
          color: layer.fill ?? '#ffffff',
          textAlign: (layer.align ?? 'left') as any,
          lineHeight: 1.2,
          whiteSpace: 'pre-line',
          pointerEvents: 'none',
        },
      }, layer.text)
    )
  );

const StyleTemplatesGrid = ({ store, addText }: { store: StoreType; addText: (attrs: any) => void }) => {
  const handleSelect = (tpl: StyleTemplate) => {
    const scale = (store.width + store.height) / 2160;
    const canvasW = store.width;
    const canvasH = store.height;
    store.history.transaction(() => {
      const ids: string[] = [];
      tpl.layers.forEach((layer) => {
        const w = layer._pw * canvasW;
        const x = layer._px * canvasW;
        const y = layer._py * canvasH;
        store.loadFont(layer.fontFamily);
        const el = store.activePage?.addElement({
          type: 'text',
          text: layer.text,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize * scale,
          fontWeight: layer.fontWeight ?? 'normal',
          fontStyle: layer.fontStyle ?? 'normal',
          fill: layer.fill ?? '#ffffff',
          align: layer.align ?? 'left',
          x,
          y,
          width: w,
          height: layer.fontSize * scale * 1.4 * (layer.text.split('\n').length),
          lineHeight: 1.2,
        });
        if (el?.id) ids.push(el.id);
      });
      if (ids.length) store.selectElements(ids);
    });
  };

  return React.createElement(
    'div',
    { style: { marginBottom: '12px' } },
    React.createElement(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        },
      },
      STYLE_TEMPLATES.map((tpl) =>
        React.createElement(TemplateCard, {
          key: tpl.id,
          tpl,
          onClick: () => handleSelect(tpl),
        })
      )
    )
  );
};

const FontShowcaseGrid = observer(({ store, addText }: { store: StoreType; addText: (attrs: any) => void }) => {
  const [search, setSearch] = React.useState('');
  const allFonts = getFontsList();
  const filtered = search
    ? allFonts.filter((f: string) => f.toLowerCase().includes(search.toLowerCase()))
    : allFonts;

  return React.createElement(
    'div',
    null,
    React.createElement('input', {
      placeholder: 'Search fonts…',
      value: search,
      onChange: (e: any) => setSearch(e.target.value),
      style: {
        width: '100%',
        boxSizing: 'border-box',
        marginBottom: '8px',
        padding: '6px 10px',
        border: '1px solid rgba(0,0,0,0.2)',
        borderRadius: '4px',
        fontSize: '13px',
        outline: 'none',
      },
    }),
    React.createElement(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          paddingBottom: '8px',
        },
      },
      filtered.map((fontFamily: string) =>
        React.createElement(
          FontPreviewBox,
          {
            key: fontFamily,
            style: { fontFamily: `"${fontFamily}"`, fontSize: '18px', height: '72px', marginBottom: 0 },
            title: fontFamily,
            onClick: () => {
              store.loadFont(fontFamily);
              addText({ fontSize: 60, text: 'Add a text', fontFamily });
            },
          },
          fontFamily
        )
      )
    )
  );
});

const TEMPLATE_FONTS = [...new Set(STYLE_TEMPLATES.flatMap((t) => t.layers.map((l) => l.fontFamily)))];

export const TextPanel = observer(({ store }: { store: StoreType }) => {
  React.useEffect(() => {
    store.loadFont('Roboto');
    TEMPLATE_FONTS.forEach((f) => store.loadFont(f));
  }, []);

  const addText = (attrs: any) => {
    const width = attrs.width || store.width / 2;
    const x = ((attrs?.x) || store.width / 2) - width / 2;
    const y = ((attrs?.y) || store.height / 2) - attrs.fontSize / 2;
    const scale = (store.width + store.height) / 2160;
    const el = store.activePage?.addElement(Object.assign({ type: 'text', fontFamily: 'Roboto' }, attrs, {
      x, y, width, fontSize: attrs.fontSize * scale,
    }));
    if (!isMobile()) el?.toggleEditMode(true);
  };

  React.useEffect(() => { store.fonts.forEach((f: any) => store.loadFont(f.fontFamily)); }, [store.fonts]);

  const [activeTab, setActiveTab] = React.useState('text');

  return React.createElement(
    'div',
    { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(
      Tabs,
      { large: true, onChange: (id: any) => setActiveTab(id) },
      React.createElement(Tab, { id: 'text' }, s('sidePanel.text')),
      React.createElement(Tab, { id: 'font' }, s('sidePanel.myFonts'))
    ),
    activeTab === 'text' && React.createElement(
      TextPanelContent,
      null,
      React.createElement(DraggableButton, {
        style: { marginBottom: '5px', width: '100%', fontSize: '25px', fontFamily: 'Roboto' },
        minimal: true,
        onSelect: (pos: any) => { addText(Object.assign(Object.assign({}, pos), { fontSize: 76, text: s('sidePanel.headerText'), fontFamily: 'Roboto' })); },
      }, s('sidePanel.createHeader')),
      React.createElement(DraggableButton, {
        style: { marginBottom: '5px', width: '100%', fontSize: '18px', fontFamily: 'Roboto' },
        minimal: true,
        onSelect: (pos: any) => { addText(Object.assign(Object.assign({}, pos), { fontSize: 44, text: s('sidePanel.subHeaderText'), fontFamily: 'Roboto' })); },
      }, s('sidePanel.createSubHeader')),
      React.createElement(DraggableButton, {
        style: { marginBottom: '5px', width: '100%', fontSize: '14px', fontFamily: 'Roboto' },
        minimal: true,
        onSelect: (pos: any) => { addText(Object.assign(Object.assign({}, pos), { fontSize: 30, text: s('sidePanel.bodyText'), fontFamily: 'Roboto' })); },
      }, s('sidePanel.createBody')),
      React.createElement(
        'div',
        { style: { flex: 1, overflowY: 'auto', minHeight: 0 } },
        React.createElement(
          'div',
          { style: { fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', marginTop: '4px' } },
          'Text styles'
        ),
        React.createElement(StyleTemplatesGrid, { store, addText })
      )
    ),
    activeTab === 'font' && React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', height: 'calc(100% - 50px)' } },
      React.createElement(
        'label',
        { htmlFor: 'raeditor-font-upload' },
        React.createElement(Button, {
          icon: React.createElement(Upload, null),
          style: { width: '100%' },
          onClick: () => { (document.querySelector('#raeditor-font-upload') as HTMLElement)?.click(); },
        }, s('sidePanel.uploadFont')),
        React.createElement('input', {
          type: 'file',
          accept: '.ttf, .otf, .woff, .woff2, .eot',
          id: 'raeditor-font-upload',
          style: { display: 'none' },
          onChange: async (e: any) => {
            const { target } = e;
            for (const file of target.files) {
              const url = await fontUploadFunc(file);
              const fontFamily = file.name.split('.')[0].replace(/,/g, '');
              store.addFont({ fontFamily, url });
            }
            target.value = null;
          },
        })
      ),
      React.createElement(
        'div',
        { style: { paddingTop: '20px', overflow: 'auto', height: '100%' } },
        store.fonts.map((font: any, idx: number) =>
          React.createElement(FontItem, {
            font,
            key: idx,
            onSelect: () => { addText({ fontSize: 80, text: 'Cool text', fontFamily: font.fontFamily }); },
            onRemove: () => {
              store.find((el: any) => {
                if (el.type === 'text' && el.fontFamily === font.fontFamily) el.set({ fontFamily: 'Roboto' });
              });
              store.removeFont(font.fontFamily);
            },
          })
        )
      )
    )
  );
});
