import {
  passUrlQualityGate,
  passDocumentQualityGate,
  passManualTextGate,
} from './knowledge-quality.gate';

describe('KnowledgeQualityGate', () => {
  describe('passUrlQualityGate', () => {
    it('rejects ok=true but okContent=false', () => {
      expect(passUrlQualityGate({ ok: true, okContent: false })).toEqual({
        pass: false,
        reason: 'quality_gate',
      });
    });

    it('accepts ok=true and okContent=true', () => {
      expect(passUrlQualityGate({ ok: true, okContent: true })).toEqual({ pass: true });
    });

    it('rejects ok=false', () => {
      expect(passUrlQualityGate({ ok: false })).toEqual({
        pass: false,
        reason: 'parse_failed',
      });
    });
  });

  describe('passDocumentQualityGate', () => {
    it('requires minimum chars for files', () => {
      expect(passDocumentQualityGate({ ok: true, chars: 100 }, 500)).toEqual({
        pass: false,
        reason: 'min_chars',
      });
    });

    it('passes when chars sufficient', () => {
      expect(passDocumentQualityGate({ ok: true, chars: 600 }, 500)).toEqual({ pass: true });
    });
  });

  describe('passManualTextGate', () => {
    it('rejects short manual text', () => {
      expect(passManualTextGate('short')).toEqual({ pass: false, reason: 'min_chars' });
    });
  });
});
