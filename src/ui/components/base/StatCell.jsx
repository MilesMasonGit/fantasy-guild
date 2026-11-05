/**
 * One cell of a stat block (the Token card's, the fight window's): a small caption over its value.
 */
export const StatCell = ({ caption, children, className = '', ...rest }) => (
    <div className={`flex flex-col min-w-0 ${className}`} {...rest}>
        <span className="ui-text-small gi-caps tracking-wider text-gi-muted leading-tight">{caption}</span>
        <span className="ui-text-body text-gi-text">{children}</span>
    </div>
);

export default StatCell;
