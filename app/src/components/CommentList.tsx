import type { FamilyComment } from '../lib/comments';

interface CommentListProps {
  comments: FamilyComment[];
  error: string | null;
  emptyText: string;
  onLike?: (commentId: string) => void;
  likingId?: string | null;
}

export function CommentList({ comments, error, emptyText, onLike, likingId }: CommentListProps) {
  if (error) return <p className="error-text">{error}</p>;
  if (comments.length === 0) return <p>{emptyText}</p>;

  return (
    <>
      {comments.map((c) => (
        <div className="comment-row" key={c.id}>
          <div style={{ flex: 1 }}>
            <p className="comment-author">{c.familyDisplayName ?? '家人'}</p>
            <p className="comment-text">{c.commentText}</p>
          </div>
          {onLike && !c.liked ? (
            <button
              className="like-btn"
              disabled={likingId === c.id}
              onClick={() => onLike(c.id)}
            >
              🤍
            </button>
          ) : (
            <span className="like-btn">{c.liked ? '❤️' : '🤍'}</span>
          )}
        </div>
      ))}
    </>
  );
}
