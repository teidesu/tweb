import { Reaction } from '@/layer';

export default function getReactionKey(reaction: Reaction): string {
  switch (reaction._) {
    case 'reactionEmoji': return 'e:' + reaction.emoticon;
    case 'reactionCustomEmoji': return 'c:' + reaction.document_id;
    case 'reactionPaid': return 'paid';
    default: return 'empty';
  }
}
