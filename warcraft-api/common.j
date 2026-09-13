type agent extends handle
type player extends agent

constant native GetLocalPlayer takes nothing returns player
native DisplayTextToPlayer takes player toPlayer, real x, real y, string message returns nothing
