# Reflexes

Behavior that keeps the bot's units alive, whatever else wants them: so far, worker safety, which makes attacked workers flee.

The mind steps every reflex on every step, before anything else, so a reflex takes its units over before others order them in the same step. A reflex claims the units it protects with preemptive actor control, which takes them from whatever held them; once they are safe, it stops requesting them and they are free again.

A reflex reads only the Beliefs and acts only through the capabilities the mind gives it.
