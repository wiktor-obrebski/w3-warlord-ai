# Playbooks

The bot's strategies, written down as data: each playbook is a list of phases, and each phase begins once its condition holds and proposes the Desires that carry the strategy out. Phases begin in order and last until the next one begins. So far there is one playbook, the Human tower rush.

A playbook also writes down how its economy is built up, as a build order (`contracts/build-order.ts`): its phases hand the build order to RunEconomy in the Desire they propose, so RunEconomy knows nothing of playbooks.

A playbook commits to nothing by itself. The strategy concern proposes executing the playbook the bot prefers; once Deliberation adopts that Desire, the ExecuteStrategy Intention follows the playbook and proposes its current phase's Desires, which compete on the agenda like any other.

The playbook type is a contract (`contracts/playbook.ts`). Playbooks import only `@lib/**` and `contracts/`, and reach the ExecuteStrategy Intention kind through its Capabilities.
