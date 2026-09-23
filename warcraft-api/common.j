type agent extends handle
type widget extends agent
type unit extends widget
type player extends agent
type group extends agent
type boolexpr extends agent
type unittype extends handle
type pathingtype extends handle

constant native ConvertUnitType takes integer i returns unittype
constant native ConvertPathingType takes integer i returns pathingtype

globals
    constant unittype UNIT_TYPE_PEON = ConvertUnitType(16)
    constant pathingtype PATHING_TYPE_WALKABILITY = ConvertPathingType(1)
endglobals

native Sin takes real radians returns real
native Cos takes real radians returns real

native I2S takes int nb returns string

native CreateGroup takes nothing returns group
native DestroyGroup takes group whichGroup returns nothing
native GroupRemoveUnit takes group whichGroup, unit whichUnit returns boolean
native GroupEnumUnitsOfPlayer takes group whichGroup, player whichPlayer, boolexpr filter returns nothing
native FirstOfGroup takes group whichGroup returns unit

constant native GetUnitX takes unit whichUnit returns real
constant native GetUnitY takes unit whichUnit returns real
constant native IsUnitType takes unit whichUnit, unittype whichUnitType returns boolean

native IssuePointOrder takes unit whichUnit, string order, real x, real y returns boolean
constant native Player takes integer number returns player
constant native GetLocalPlayer takes nothing returns player
native DisplayTextToPlayer takes player toPlayer, real x, real y, string message returns nothing
native GetRandomReal takes real lowBound, real highBound returns real
native IsTerrainPathable takes real x, real y, pathingtype t returns boolean
